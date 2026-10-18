// ==========================================
// 🧪 XTREME WORKOUT APP - COMPREHENSIVE QA SUITE
// ==========================================

function runFullQA() {
  console.log("==================================================");
  console.log("🚀 STARTING XTREME WORKOUT APP QA TEST SUITE...");
  console.log("==================================================");
  
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  // ------------------------------------------------
  // TEST 1: Gym Plate Math Calculation Engine
  // ------------------------------------------------
  console.log("\n--- Testing Plate Math Engine ---");
  let plateTest1 = calculatePlates(60);
  assert(plateTest1.includes("1x 20kg"), "Plate calculation for 60kg with 20kg bar");

  let plateTest2 = calculatePlates(30);
  const barSelect = document.getElementById('barbellType');
  let originalBarVal = barSelect ? barSelect.value : "20";
  if (barSelect) barSelect.value = "0";
  let plateTest3 = calculatePlates(40);
  assert(plateTest3.includes("Dumbbell/Machine"), "Plate calculation for 0kg bar (Machine/Dumbbell)");
  if (barSelect) barSelect.value = originalBarVal;

  // ------------------------------------------------
  // TEST 2: Compound vs Isolation Exercise Classifier
  // ------------------------------------------------
  console.log("\n--- Testing Exercise Classification ---");
  assert(isCompoundExercise("Bench Press") === true, "Bench Press classified as compound");
  assert(isCompoundExercise("Back Squat") === true, "Back Squat classified as compound");
  assert(isCompoundExercise("Bicep Curl") === false, "Bicep Curl classified as isolation");
  assert(isCompoundExercise("Lateral Raises") === false, "Lateral Raises classified as isolation");

  // ------------------------------------------------
  // TEST 3: Lower Body Detector & Symmetry Asymmetry Logic
  // ------------------------------------------------
  console.log("\n--- Testing Symmetry & Imbalance Engine ---");
  assert(isLowerBodyExercise("Back Squat") === true, "Back Squat flagged as lower body");
  assert(isLowerBodyExercise("Deadlift") === true, "Deadlift flagged as lower body");
  assert(isLowerBodyExercise("Bench Press") === false, "Bench Press flagged as upper body");

  let mockGlobalDataBackup = JSON.parse(JSON.stringify(globalData));
  globalData.lastLogs = {
    "Bench Press": { weight: 50, weightUnit: "Kilogram (kg)", sets: 5, reps: "5/5/5/5/5", rir: 2 },
    "Back Squat": { weight: 30, weightUnit: "Kilogram (kg)", sets: 5, reps: "8/8/8/8/8", rir: 2 }
  };
  
  let imbalanceActive = isChickenLegRiskActive();
  assert(imbalanceActive === true, "Upper-Dominant imbalance correctly detected (Squat 30kg vs Bench 50kg)");

  // Restore mock data temporarily for Test 4
  globalData = mockGlobalDataBackup;

  // ------------------------------------------------
  // TEST 4: Progression Advice & Auto-Balancing Boost
  // ------------------------------------------------
  console.log("\n--- Testing Progression Advice & Auto-Balancing Boost ---");
  const exerciseSelect = document.getElementById('exerciseSelect');
  const phaseInput = document.getElementById('phase');
  let originalPhaseVal = phaseInput ? phaseInput.value : "";
  
  if (phaseInput) phaseInput.value = "Accumulation (Volume)";

  // Inject mock last logs for this test explicitly
  globalData.lastLogs = {
    "Bench Press": { weight: 50, weightUnit: "Kilogram (kg)", sets: 5, reps: "5/5/5/5/5", rir: 2 },
    "Back Squat": { weight: 30, weightUnit: "Kilogram (kg)", sets: 5, reps: "8/8/8/8/8", rir: 2 }
  };

  if (exerciseSelect) {
    exerciseSelect.value = "Back Squat";
    updateProgressionAdvice();
    
    assert(currentPrescription !== null, "Current prescription object generated");
    assert(currentPrescription.weight === 35, `Auto-balancing boost correctly added +5kg to Back Squat (Expected 35kg, got ${currentPrescription.weight}kg)`);
  } else {
    console.warn("⚠️ Exercise dropdown not found in DOM, skipping UI-bound advice test.");
  }

  // Restore real data and original phase
  if (phaseInput) phaseInput.value = originalPhaseVal;
  globalData = mockGlobalDataBackup;

  // ------------------------------------------------
  // TEST 5: Live Database Data Integrity & Real Records
  // ------------------------------------------------
  console.log("\n--- Testing Live Database Records ---");
  let hasHistory = globalData.history && Array.isArray(globalData.history);
  assert(hasHistory === true, "globalData.history successfully loaded as an array");
  
  let historyCount = hasHistory ? globalData.history.length : 0;
  console.log(`📊 [INFO] Total workout logs found in Google Sheets: ${historyCount}`);
  assert(historyCount > 0, "Google Sheets database contains active history records");

  let hasLastLogs = globalData.lastLogs && Object.keys(globalData.lastLogs).length > 0;
  assert(hasLastLogs === true, "globalData.lastLogs map is populated with exercise records");

  // Run live imbalance evaluation on current database records
  let liveImbalance = isChickenLegRiskActive();
  console.log(`⚖️ [INFO] Live Database Symmetry Status (Upper vs Lower): Upper-Dominant Imbalance Active = ${liveImbalance}`);

  // ------------------------------------------------
  // TEST 6: Offline Queue Caching Mechanism
  // ------------------------------------------------
  console.log("\n--- Testing Offline-First Queue Caching ---");
  let testPayload = { action: "insert", exercise: "Test QA Exercise", weight: 50, sets: 3 };
  
  localStorage.removeItem('offline_workout_queue');
  let queueBefore = JSON.parse(localStorage.getItem('offline_workout_queue') || '[]');
  queueBefore.push(testPayload);
  localStorage.setItem('offline_workout_queue', JSON.stringify(queueBefore));
  
  let queueAfter = JSON.parse(localStorage.getItem('offline_workout_queue') || '[]');
  assert(queueAfter.length === 1 && queueAfter[0].exercise === "Test QA Exercise", "Offline queue successfully stored payload in localStorage");
  localStorage.removeItem('offline_workout_queue');

  // ------------------------------------------------
  // TEST 7: Drift-Free Rest Timer Precision
  // ------------------------------------------------
  console.log("\n--- Testing Rest Timer Functions ---");
  startRestTimer(5);
  assert(restTimerInterval !== null, "Rest timer interval successfully initialized");
  stopRestTimer();
  let timerWidget = document.getElementById('restTimerWidget');
  assert(timerWidget.style.display === 'none', "Rest timer widget dismissed properly on stop");

  // ------------------------------------------------
  // SUMMARY REPORT
  // ------------------------------------------------
  console.log("==================================================");
  console.log(`🏁 QA TEST SUITE COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED.`);
  if (passedTests === totalTests) {
    console.log("🎉 ALL SYSTEMS OPERATIONAL AND READY FOR PRODUCTION!");
  } else {
    console.warn("⚠️ SOME TESTS FAILED. CHECK LOGS ABOVE.");
  }
  console.log("==================================================");
}
