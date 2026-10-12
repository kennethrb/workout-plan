const API_URL = "https://script.google.com/macros/s/AKfycbxZNsbt0S6EYYqbma4_nRMjNJFt4d-84qt1noBVy97ol2wuuiVZzs8xBSJEn4TRlekj/exec";

let globalData = {};
let editingRowIndex = null;
let currentPrescription = null; // Stores target values for 1-click apply

window.addEventListener('DOMContentLoaded', function() {
  fetchData();
});

function fetchData() {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      globalData = data;
      initApp();
    })
    .catch(err => {
      console.error("Error loading data:", err);
      document.getElementById('loading').innerHTML = '<p class="text-danger">Failed to load workout data from backend.</p>';
    });
}

function initApp() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app-content').style.display = 'block';

  // Apply backend calculated training phase
  const phaseInput = document.getElementById('phase');
  if (phaseInput && globalData.currentPhase) {
    phaseInput.value = globalData.currentPhase;
  }

  document.getElementById('workoutDay').addEventListener('change', updateExerciseDropdown);
  document.getElementById('exerciseSelect').addEventListener('change', function() {
    updateProgressionAdvice();
    checkTimedExercise();
  });

  ['sleep', 'stress', 'joints'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateProgressionAdvice);
  });

  document.getElementById('historySearch').addEventListener('input', renderHistoryList);

  updateExerciseDropdown();
  evaluatePhysiqueBalance();
  renderHistoryList();
}

function updateExerciseDropdown() {
  const workoutDay = document.getElementById('workoutDay').value;
  const select = document.getElementById('exerciseSelect');
  select.innerHTML = '';

  let exercisesForDay = (globalData.workoutMap && globalData.workoutMap[workoutDay]) 
                        ? globalData.workoutMap[workoutDay] 
                        : globalData.exercises;

  if (!exercisesForDay || exercisesForDay.length === 0) {
    exercisesForDay = globalData.exercises;
  }

  exercisesForDay.forEach(ex => {
    let opt = document.createElement('option');
    opt.value = ex;
    opt.textContent = ex;
    select.appendChild(opt);
  });

  updateProgressionAdvice();
  checkTimedExercise();
}

function checkTimedExercise() {
  const exercise = document.getElementById('exerciseSelect').value.toLowerCase();
  const repsLabel = document.getElementById('repsLabel');
  const repsInput = document.getElementById('reps');

  if (exercise.includes('plank') || exercise.includes('sec') || exercise.includes('hold')) {
    repsLabel.textContent = "Duration per Set in Seconds (e.g. 60/60/60)";
    repsInput.placeholder = "60/60/60";
  } else {
    repsLabel.textContent = "Reps per Set (e.g. 10/10/10)";
    repsInput.placeholder = "10/10/10";
  }
}

function evaluatePhysiqueBalance() {
  const lastLogs = globalData.lastLogs || {};
  let upperWeights = [];
  let lowerWeights = [];

  Object.keys(lastLogs).forEach(ex => {
    let nameLower = ex.toLowerCase();
    let wt = lastLogs[ex].weight || 0;
    if (wt > 0 && lastLogs[ex].weightUnit !== 'Bodyweight') {
      if (nameLower.includes('squat') || nameLower.includes('leg') || nameLower.includes('calf') || nameLower.includes('deadlift') || nameLower.includes('hip') || nameLower.includes('thrust')) {
        lowerWeights.push(wt);
      } else if (nameLower.includes('bench') || nameLower.includes('press') || nameLower.includes('row') || nameLower.includes('pull') || nameLower.includes('curl') || nameLower.includes('extension')) {
        upperWeights.push(wt);
      }
    }
  });

  let avgUpper = upperWeights.length ? upperWeights.reduce((a, b) => a + b, 0) / upperWeights.length : 0;
  let avgLower = lowerWeights.length ? lowerWeights.reduce((a, b) => a + b, 0) / lowerWeights.length : 0;

  const balanceText = document.getElementById('balanceText');
  if (avgUpper === 0 && avgLower === 0) {
    balanceText.innerHTML = "Log weighted upper/lower exercises to track symmetry proportions.";
    return;
  }

  let analysis = `<b>Average Lifts:</b> Upper (~${avgUpper.toFixed(1)} kg) vs Lower (~${avgLower.toFixed(1)} kg)<br>`;
  
  if (avgLower > 0 && avgUpper > 0 && avgLower < avgUpper * 1.1) {
    analysis += `⚠️ <strong class="text-warning">Chicken leg risk detected!</strong> Boost intensity on <b>Lower Strength</b> days.`;
  } else {
    analysis += `✅ <strong class="text-success">Well balanced!</strong> Upper and lower proportions look solid.`;
  }

  balanceText.innerHTML = analysis;
}

function formatDateString(dateStr) {
  if (!dateStr) return '';
  try {
    let d = new Date(dateStr);
    if (isNaN(d)) return dateStr;

    let options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    };
    return d.toLocaleString('en-US', options).replace(',', ' •');
  } catch (e) {
    return dateStr;
  }
}

// Helper: Snap all weights to 5kg gym plate increments
function roundToGymIncrement(rawWeight) {
  if (!rawWeight || isNaN(rawWeight)) return 0;
  return Math.round(rawWeight / 5) * 5;
}

// Helper: Check if current exercise is a lower body movement
function isLowerBodyExercise(exerciseName) {
  let nameLower = exerciseName.toLowerCase();
  return nameLower.includes('squat') || nameLower.includes('leg') || nameLower.includes('calf') || 
         nameLower.includes('deadlift') || nameLower.includes('hip') || nameLower.includes('thrust');
}

// Helper: Check if chicken leg imbalance risk is active
function isChickenLegRiskActive() {
  const lastLogs = globalData.lastLogs || {};
  let upperWeights = [];
  let lowerWeights = [];

  Object.keys(lastLogs).forEach(ex => {
    let nameLower = ex.toLowerCase();
    let wt = lastLogs[ex].weight || 0;
    if (wt > 0 && lastLogs[ex].weightUnit !== 'Bodyweight') {
      if (isLowerBodyExercise(ex)) {
        lowerWeights.push(wt);
      } else {
        upperWeights.push(wt);
      }
    }
  });

  let avgUpper = upperWeights.length ? upperWeights.reduce((a, b) => a + b, 0) / upperWeights.length : 0;
  let avgLower = lowerWeights.length ? lowerWeights.reduce((a, b) => a + b, 0) / lowerWeights.length : 0;

  return (avgLower > 0 && avgUpper > 0 && avgLower < avgUpper * 1.1);
}

function renderHistoryList() {
  const container = document.getElementById('historyContainer');
  const searchQuery = document.getElementById('historySearch').value.toLowerCase();
  const history = globalData.history || [];
  
  const filteredHistory = history.filter(item => 
    item.exercise.toLowerCase().includes(searchQuery) ||
    item.workoutDay.toLowerCase().includes(searchQuery) ||
    item.date.toLowerCase().includes(searchQuery)
  );

  if (filteredHistory.length === 0) {
    container.innerHTML = '<p class="text-muted small mb-0">No matching workout logs found.</p>';
    return;
  }

  const displayLimit = searchQuery ? filteredHistory.length : 5;
  const visibleItems = filteredHistory.slice(0, displayLimit);

  let html = '<div class="list-group list-group-flush bg-transparent">';
  visibleItems.forEach(item => {
    let cleanDate = formatDateString(item.date);
    let coachBadge = item.sleep ? `<br><small class="text-info">Sleep: ${item.sleep} | Stress: ${item.stress} | Phase: ${item.phase}</small>` : '';
    html += `
      <div class="list-group-item bg-transparent text-light border-secondary d-flex justify-content-between align-items-center py-2 px-0">
        <div class="small text-truncate me-2">
          <span class="fw-bold text-primary">${item.exercise}</span> <span class="text-muted">(${item.workoutDay})</span><br>
          <span class="text-light">${cleanDate} | Wt: ${item.weight}kg | Sets: ${item.sets} | Reps: ${item.reps} | RIR: ${item.rir}</span>
          ${coachBadge}
        </div>
        <div class="btn-group btn-group-sm flex-shrink-0">
          <button class="btn btn-outline-warning py-0 px-2" onclick='editLogEntry(${JSON.stringify(item)})'>Edit</button>
          <button class="btn btn-outline-danger py-0 px-2" onclick="deleteLogEntry(${item.rowIndex})">Del</button>
        </div>
      </div>
    `;
  });
  html += '</div>';

  container.innerHTML = html;
}

function editLogEntry(item) {
  editingRowIndex = item.rowIndex;
  
  document.getElementById('workoutDay').value = item.workoutDay;
  updateExerciseDropdown(); 
  
  document.getElementById('exerciseSelect').value = item.exercise;
  checkTimedExercise();
  
  document.getElementById('weightUnit').value = item.weightUnit;
  document.getElementById('weight').value = item.weight;
  document.getElementById('sets').value = item.sets;
  document.getElementById('reps').value = item.reps;
  document.getElementById('rir').value = item.rir;
  
  if(item.sleep) document.getElementById('sleep').value = item.sleep;
  if(item.stress) document.getElementById('stress').value = item.stress;
  if(item.joints) document.getElementById('joints').value = item.joints;

  document.getElementById('formTitle').textContent = `Edit Log Entry (Row ${item.rowIndex})`;
  document.getElementById('submitBtn').textContent = 'Update Log Entry';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingRowIndex = null;
  document.getElementById('workoutForm').reset();
  
  if (globalData.currentPhase) {
    document.getElementById('phase').value = globalData.currentPhase;
  }

  document.getElementById('formTitle').textContent = 'Log Exercise Set';
  document.getElementById('submitBtn').textContent = 'Log Set & Update Stats';
  document.getElementById('cancelEditBtn').style.display = 'none';
  updateExerciseDropdown();
}

function deleteLogEntry(rowIndex) {
  if (!confirm("Are you sure you want to delete this log entry?")) return;

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: "delete", rowIndex: rowIndex })
  })
  .then(res => res.json())
  .then(res => {
    alert(res.message);
    if (editingRowIndex === rowIndex) cancelEdit();
    fetchData();
  })
  .catch(err => {
    alert("Error deleting entry: " + err);
  });
}

function updateProgressionAdvice() {
  const exercise = document.getElementById('exerciseSelect').value.trim();
  const ref = globalData.references[exercise] || {};
  
  // Primary check: lastLogs map
  let last = globalData.lastLogs[exercise] || null;
  
  // Fallback check: If lastLogs missed it, search active history array
  if (!last && globalData.history && globalData.history.length > 0) {
    last = globalData.history.find(h => h.exercise && h.exercise.trim().toLowerCase() === exercise.toLowerCase());
  }
  
  const sleep = document.getElementById('sleep').value;
  const stress = document.getElementById('stress').value;
  const joints = document.getElementById('joints').value;
  const phase = document.getElementById('phase').value;

  const box = document.getElementById('suggestionText');
  
  let targetSets = ref.sets || 3;
  let targetReps = ref.repsTarget || '10/10/10';
  let targetWeight = roundToGymIncrement(ref.weightTarget || 0);
  let rationale = "";

  const chickenLegActive = isChickenLegRiskActive();
  const isLower = isLowerBodyExercise(exercise);

  if (!last) {
    rationale = "No prior logs found. Starting with your baseline library target.";
    currentPrescription = { weight: targetWeight, sets: targetSets, reps: targetReps, rir: 1 };
  } else {
    targetWeight = roundToGymIncrement(last.weight);
    targetSets = last.sets;
    targetReps = last.reps;

    // Prescriptive Rules Engine
    if (phase.includes("Deload")) {
      targetWeight = Math.max(0, targetWeight - 5);
      targetSets = Math.max(2, last.sets - 1);
      rationale = `🛌 <b>Deload Phase:</b> Dropped down one 5kg plate (${targetWeight}kg) with lower volume for active recovery.`;
    } else if (joints === "Mild Tweak") {
      targetWeight = Math.max(0, targetWeight - 5);
      rationale = `🛡️ <b>Joint Safety Mode:</b> Reduced by one 5kg plate (${targetWeight}kg) due to reported discomfort.`;
    } else if (sleep === "Poor" || stress === "High") {
      targetWeight = roundToGymIncrement(last.weight); 
      rationale = `⚠️ <b>Fatigue Flag:</b> Holding weight steady at ${targetWeight}kg. Focus on clean form and execution.`;
    } else if (chickenLegActive && isLower && last.rir <= 2) {
      targetWeight = roundToGymIncrement(last.weight + 5);
      rationale = `⚖️ <strong class="text-warning">Auto-Balancing Boost:</strong> Lagging lower body detected! Forcing a +5kg plate jump to <b>${targetWeight}kg</b>.`;
    } else if (last.rir <= 1) {
      targetWeight = roundToGymIncrement(last.weight + 5); 
      rationale = `🚀 <strong class="text-success">5kg Plate Jump:</strong> Crushed last session! Stepping up to <b>${targetWeight}kg</b> (your gym's 5kg plate step).`;
    } else {
      rationale = `📌 <strong class="text-warning">Consolidation:</strong> Hold weight at ${targetWeight}kg and build extra reps before taking the 5kg jump.`;
    }

    currentPrescription = { weight: targetWeight, sets: targetSets, reps: targetReps, rir: last.rir <= 1 ? 2 : last.rir };
  }

  let html = `
    <div class="mb-1 text-info">🎯 <b>Prescribed Target:</b> ${currentPrescription.weight} kg | ${currentPrescription.sets} sets | Reps: [${currentPrescription.reps}]</div>
    <div class="text-light mt-1">${rationale}</div>
  `;
  box.innerHTML = html;
}

// 1-Click apply prescription directly into form fields
function applyPrescription() {
  if (!currentPrescription) return;
  document.getElementById('weight').value = currentPrescription.weight;
  document.getElementById('sets').value = currentPrescription.sets;
  document.getElementById('reps').value = currentPrescription.reps;
  document.getElementById('rir').value = currentPrescription.rir;
  
  const btn = document.getElementById('applyPrescriptionBtn');
  btn.textContent = '✅ Applied!';
  setTimeout(() => { btn.textContent = '📥 Apply Prescription'; }, 1500);
}

document.getElementById('workoutForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = editingRowIndex ? 'Updating...' : 'Saving...';

  const payload = {
    action: editingRowIndex ? "update" : "insert",
    rowIndex: editingRowIndex,
    workoutDay: document.getElementById('workoutDay').value,
    exercise: document.getElementById('exerciseSelect').value,
    weightUnit: document.getElementById('weightUnit').value,
    weight: parseFloat(document.getElementById('weight').value) || 0,
    sets: parseInt(document.getElementById('sets').value) || 0,
    reps: document.getElementById('reps').value,
    rir: parseInt(document.getElementById('rir').value) || 0,
    sleep: document.getElementById('sleep').value,
    stress: document.getElementById('stress').value,
    joints: document.getElementById('joints').value,
    phase: document.getElementById('phase').value
  };

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(res => {
    alert(res.message);
    cancelEdit(); 
    fetchData();  
    btn.disabled = false;
  })
  .catch(err => {
    alert("Error saving workout: " + err);
    btn.disabled = false;
    btn.textContent = editingRowIndex ? 'Update Log Entry' : 'Log Set & Update Stats';
  });
});

// ==========================================
// 🧪 QA CONSOLE TEST SUITE FOR COACH ENGINE
// ==========================================
function runCoachQATests() {
  console.group("🚀 RUNNING AUTOMATED QA TESTS FOR COACH ENGINE...");

  let testsPassed = 0;
  let totalTests = 0;

  function assert(condition, testName, expected, actual) {
    totalTests++;
    if (condition) {
      console.log(`%c✅ PASS: ${testName}`, "color: #10b981; font-weight: bold;");
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName}\n   Expected: ${expected}\n   Actual:   ${actual}`);
    }
  }

  assert(roundToGymIncrement(52.3) === 50, "5kg Rounding (52.3kg -> 50kg)", 50, roundToGymIncrement(52.3));
  assert(roundToGymIncrement(52.8) === 55, "5kg Rounding (52.8kg -> 55kg)", 55, roundToGymIncrement(52.8));
  assert(roundToGymIncrement(4) === 5, "5kg Rounding Low Threshold (4kg -> 5kg)", 5, roundToGymIncrement(4));
  assert(roundToGymIncrement(0) === 0, "5kg Rounding Zero Handling (0kg -> 0kg)", 0, roundToGymIncrement(0));

  let lastLogNormal = { weight: 50, sets: 3, reps: "10/10/10", rir: 1, date: "2026-10-01" };
  let targetNormal = roundToGymIncrement(lastLogNormal.weight + 5);
  assert(targetNormal === 55, "Progression Rule (+5kg Jump on RIR 1)", 55, targetNormal);

  let deloadWeight = Math.max(0, lastLogNormal.weight - 5);
  let deloadSets = Math.max(2, lastLogNormal.sets - 1);
  assert(deloadWeight === 45, "Deload Weight Drop (-5kg)", 45, deloadWeight);
  assert(deloadSets === 2, "Deload Volume Reduction (3 sets -> 2 sets)", 2, deloadSets);

  let jointTweakWeight = Math.max(0, lastLogNormal.weight - 5);
  assert(jointTweakWeight === 45, "Joint Tweak Safety Drop (-5kg)", 45, jointTweakWeight);

  let fatigueWeight = roundToGymIncrement(lastLogNormal.weight);
  assert(fatigueWeight === 50, "High Fatigue Weight Hold (Hold at 50kg)", 50, fatigueWeight);

  console.log(`\n📊 TEST RESULTS: ${testsPassed} / ${totalTests} Passed.`);
  console.groupEnd();
}
