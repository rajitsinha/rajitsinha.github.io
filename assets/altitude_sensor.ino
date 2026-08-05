#include <Wire.h>
#include <Adafruit_DPS310.h>
#include <Servo.h>
#include <EEPROM.h>
#include <math.h>   // fabs(), pow(), log()

//altimeter
Adafruit_DPS310 dps;
const float SEA_LEVEL_HPA = 1013.25;
const float M_TO_FT = 3.28084;
const uint32_t SAMPLE_PERIOD_US = 20000;  // 50 Hz

//baseline averaging
const int BASELINE_SAMPLES = 30;
const float ALT_ALPHA = 0.25;  // altitude filter
const float VEL_ALPHA = 0.3;   // velocity filter

//global variables
uint32_t lastSampleUs = 0;
float baselineSum_m = 0.0;
int baselineCount = 0;
float baselineAlt_m = 0.0;
float maxAlt = 0;
unsigned long lastEEPROMWrite = 0;
const unsigned long writeInterval = 100;
bool baselineReady = false;
float altFilt_ft = 0.0;
float prevAltFilt_ft = 0.0;
float velFilt_ft_s = 0.0;

//keep last valid altitude so re-zero can be instant
float lastAlt_m = 0.0;
bool haveAlt = false;

//servo
Servo deployServo;
const int SERVO_PIN = 9;

// Mechanical limits (never go below 45)
const int SERVO_MIN = 45;     // minimum safe angle
const int SERVO_MAX = 180;    // maximum angle
const int SERVO_START = 45;   // resting / start angle (>= SERVO_MIN)

const int STEP_DELAY = 5;     // ms
const int STEP_SIZE = 1;      // degrees
bool servoActive = false;     // has servo started?

//auto reset parameters
const float STABLE_TOL_FT = 0.3;
const unsigned long STABLE_TIME_MS = 10000;
float stableRef_ft = 0.0;
unsigned long stableStartTime = 0;
bool stableTracking = false;

//triggers
const float TRIGGER_FEET = 30.0;          // testing / arming threshold in your simple logic
const float FALL_VEL_THRESHOLD = -1.0;   // ft/s considered falling
const unsigned long FALL_TIME_MS = 1000; // 1 second falling
unsigned long fallStartTime = 0;
bool falling = false;

//startup delay
const unsigned long WARMUP_MS = 2000;
unsigned long bootMs = 0;

//predict apogee parameters
const float m_rocket = 0.58;         // kg
const float g = 9.81;               // m/s^2
const float rho = 1.225;            // kg/m^3
const float Cd_rocket = 0.7;
const float A_rocket = 0.002;       // m^2
const float Cd_parachute = 0.75;
const float A_parachute = 0.05;     // m^2
const float t_delay = 0.5;          // s
const float h_target_ft = 750.0;    // target altitude in ft
const float tolerance_ft = 10.0;     // ft tolerance for prediction buffer

const float k_rocket = 0.5 * rho * Cd_rocket * A_rocket;
const float k_total  = 0.5 * rho * (Cd_rocket * A_rocket + Cd_parachute * A_parachute);

//prediction buffer
const int PRED_BUF_SIZE = 5;
float predBuffer[PRED_BUF_SIZE] = {0};
int predIndex = 0;

// ---------------------------------------------------------
float altitudeFromPressure_m(float pressure_hPa) {
  return 44330.0 * (1.0 - pow(pressure_hPa / SEA_LEVEL_HPA, 0.1903));
}

void resetBaseline() {
  baselineSum_m = 0.0;
  baselineCount = 0;

  if (haveAlt) {
    baselineAlt_m = lastAlt_m;
    baselineReady = true;
  } else {
    baselineAlt_m = 0.0;
    baselineReady = false;
    bootMs = millis();
  }

  altFilt_ft = 0.0;
  prevAltFilt_ft = 0.0;
  velFilt_ft_s = 0.0;

  stableTracking = false;
  stableStartTime = 0;

  //reset falling detector
  falling = false;
  fallStartTime = 0;

  //reset prediction buffer
  for (int i = 0; i < PRED_BUF_SIZE; i++) predBuffer[i] = 0.0f;
  predIndex = 0;
}

void deployParachute() {
  if (!servoActive) {
    servoActive = true;
    Serial.println("Parachute deployed!");
  }
}

// ---------------------------------------------------------
void setup() {
  Serial.begin(115200);

  //Arduino Nano R4: use JST-SH/Qwiic port => Wire1
  Wire1.begin();

  deployServo.attach(SERVO_PIN);
  deployServo.write(SERVO_START);  // park at safe start position (>=45)
  delay(300);

  EEPROM.get(0, maxAlt);
  Serial.print("Stored max altitude: ");
  Serial.println(maxAlt);

  //Initialize DPS310 on Nano R4 I2C bus (Wire1). Try both common I2C addresses.
  if (!dps.begin_I2C(0x77, &Wire1)) {
    if (!dps.begin_I2C(0x76, &Wire1)) {
      Serial.println("DPS310 not found on I2C (Wire1)! Check cable / address.");
      while (1) {}
    }
  }

  dps.configurePressure(DPS310_64HZ, DPS310_8SAMPLES);
  dps.configureTemperature(DPS310_1HZ,  DPS310_1SAMPLE);

  Serial.println("DPS310 ready. Zeroing baseline...");
  lastSampleUs = micros();
  bootMs = millis();
}

// ---------------------------------------------------------
void loop() {
  //manual baseline reset
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'r' || c == 'R') resetBaseline();
  }

  uint32_t nowUs = micros();
  if (nowUs - lastSampleUs < SAMPLE_PERIOD_US) return;

  float dt = (nowUs - lastSampleUs) / 1e6f;
  lastSampleUs = nowUs;

  sensors_event_t temp_event, pressure_event;
  if (!dps.getEvents(&temp_event, &pressure_event)) return;

  float pressure_hPa = pressure_event.pressure;
  if (pressure_hPa < 300.0f || pressure_hPa > 1100.0f) return;

  float alt_m = altitudeFromPressure_m(pressure_hPa);

  //update last valid altitude for instant re-zero
  lastAlt_m = alt_m;
  haveAlt = true;

  //warmup delay before baseline sampling starts on startup
  if (!baselineReady) {
    if (millis() - bootMs < WARMUP_MS) return;
  }

  //build baseline on startup
  if (!baselineReady) {
    baselineSum_m += alt_m;
    baselineCount++;
    if (baselineCount >= BASELINE_SAMPLES) {
      baselineAlt_m = baselineSum_m / baselineCount;
      baselineReady = true;

      altFilt_ft = 0.0;
      prevAltFilt_ft = 0.0;
      velFilt_ft_s = 0.0;

      stableTracking = false;
      stableStartTime = 0;

      //reset prediction buffer once baseline becomes ready
      for (int i = 0; i < PRED_BUF_SIZE; i++) predBuffer[i] = 0.0f;
      predIndex = 0;
    }
    return;
  }

  //filter velocity
  float relAlt_ft = (alt_m - baselineAlt_m) * M_TO_FT;
  altFilt_ft = (1.0f - ALT_ALPHA) * altFilt_ft + ALT_ALPHA * relAlt_ft;

  //max altitude and store in EEPROM
  if (relAlt_ft > maxAlt) maxAlt = relAlt_ft;

  if (millis() - lastEEPROMWrite >= writeInterval) {
    lastEEPROMWrite = millis();
    float storedAlt;
    EEPROM.get(0, storedAlt);
    if (maxAlt > storedAlt) EEPROM.put(0, maxAlt);
  }

  //filter out velocity
  float velRaw_ft_s = (altFilt_ft - prevAltFilt_ft) / dt;
  prevAltFilt_ft = altFilt_ft;
  velFilt_ft_s = (1.0f - VEL_ALPHA) * velFilt_ft_s + VEL_ALPHA * velRaw_ft_s;

  //reset altitude after 10 seconds if stayed in the same range
  if (!servoActive) {
    if (!stableTracking) {
      stableTracking = true;
      stableRef_ft = altFilt_ft;
      stableStartTime = millis();
    }

    if (fabs(altFilt_ft - stableRef_ft) <= STABLE_TOL_FT) {
      if (millis() - stableStartTime >= STABLE_TIME_MS) {
        resetBaseline();
        return;
      }
    } else {
      stableRef_ft = altFilt_ft;
      stableStartTime = millis();
    }
  } else {
    stableTracking = false;
    stableStartTime = 0;
  }

  //predict apogee for ascent only
  float alt_m_pred = altFilt_ft / M_TO_FT;  // ft -> m
  float vel_m_s    = velFilt_ft_s / M_TO_FT;

  float a_no_parachute = -g - (k_rocket / m_rocket) * vel_m_s * vel_m_s;
  float v_after_delay  = vel_m_s + a_no_parachute * t_delay;
  float h_during_delay = vel_m_s * t_delay + 0.5 * a_no_parachute * t_delay * t_delay;

  //Extra climb after delay
  float h_extra_after  = (m_rocket / (2 * k_total)) * log(1 + (k_total * v_after_delay * v_after_delay) / (m_rocket * g));

  float h_predicted_m  = alt_m_pred + h_during_delay + h_extra_after;
  float h_predicted_ft = h_predicted_m * M_TO_FT;

  //Update prediction buffer
  predBuffer[predIndex] = h_predicted_ft;
  predIndex = (predIndex + 1) % PRED_BUF_SIZE;

  //deploy logic
  bool deployNow = false;

  //tolerance
  bool allAbove = true;
  for (int i = 0; i < PRED_BUF_SIZE; i++) {
    if (predBuffer[i] < (h_target_ft - tolerance_ft)) {
      allAbove = false;
      break;
    }
  }
  if (allAbove) deployNow = true;

  //deploy if falling for 1 second
  if (!servoActive && velFilt_ft_s <= FALL_VEL_THRESHOLD) {
    if (!falling) {
      falling = true;
      fallStartTime = millis();
    } else if (millis() - fallStartTime >= FALL_TIME_MS) {
      deployNow = true;
    }
  } else {
    falling = false;
  }

  //failsafe where current altitude is within two feet of target
  if (altFilt_ft >= (h_target_ft - 10.0f)) deployNow = true;

  if (deployNow) deployParachute();

  //debug
  Serial.print("Rel Alt ft: "); Serial.print(relAlt_ft, 2);
  Serial.print("  Filt Alt ft: "); Serial.print(altFilt_ft, 2);
  Serial.print("  Vel ft/s: "); Serial.print(velFilt_ft_s, 2);
  Serial.print("  Pred Apogee ft: "); Serial.println(h_predicted_ft, 2);

  //servo sweep
  if (servoActive) {
    for (int pos = SERVO_START; pos <= SERVO_MAX; pos += STEP_SIZE) {
      deployServo.write(pos);
      delay(STEP_DELAY);
    }
    for (int pos = SERVO_MAX; pos >= SERVO_MIN; pos -= STEP_SIZE) {
      deployServo.write(pos);
      delay(STEP_DELAY);
    }
  }
}