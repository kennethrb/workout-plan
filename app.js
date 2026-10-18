const API_URL = "https://script.google.com/macros/s/AKfycbxZNsbt0S6EYYqbma4_nRMjNJFt4d-84qt1noBVy97ol2wuuiVZzs8xBSJEn4TRlekj/exec";

let globalData = {};
let editingRowIndex = null;
let currentPrescription = null; 
let restTimerInterval = null;
let myProgressChart = null;
let pendingDeleteRowIndex = null;
let isPlateauBreakerActive = false;

// ==========================================
// 🏋️ OPTIMIZED EXERCISE SEQUENCE MAP
// ==========================================
const WORKOUT_SEQUENCES = {
  "Upper Strength": [
    "Bench Press",
    "Barbell Row",
    "Overhead Press",
    "Pull-ups / Lat Pulldown",
    "Plank"
  ],
  "Lower Strength": [
    "Back Squat",
    "Romanian Deadlift",
    "Walking Lunges",
    "Calf Raises",
    "Hanging Leg Raises"
  ],
  "Upper Hypertrophy": [
    "Incline Dumbell Press",
    "Seated Cable Row",
    "Dumbell Shoulder Press",
    "Lateral Raises",
    "Bicep Curl",
    "Tricep Pushdown",
    "Face Pull"
  ],
  "Lower Hypertrophy": [
    "Deadlift",
    "Front Squat / Leg Press",
    "Bulgarian Split Squat",
    "Hamstring Curl",
    "Hip Thrust / Glute Bridge",
    "Ab Wheel",
    "Cable Woodchop"
  ]
};

window.addEventListener('DOMContentLoaded', function() {
  fetchData();
  syncOfflineQueue();
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
      document.getElementById('loading').innerHTML = '<p class="text-danger">Failed to load workout data from backend. Check network connectivity.</p>';
    });
}

function syncOfflineQueue() {
  let queue = JSON.parse(localStorage.getItem('offline_workout_queue') || '[]');
  if (queue.length === 0) return;

  let payload = queue.shift();
  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(() => {
    localStorage.setItem('offline_workout_queue', JSON.stringify(queue));
    showToast("Synced offline workout log successfully! 📶");
    if (queue.length > 0) syncOfflineQueue();
    else fetchData();
  })
  .catch(() => {
    queue.unshift(payload);
    localStorage.setItem('offline_workout_queue', JSON.stringify(queue));
  });
}

function initApp() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app-content').style.display = 'block';

  const phaseInput = document.getElementById('phase');
  if (phaseInput && globalData.currentPhase) {
    phaseInput.value = globalData.currentPhase;
  }

  if (globalData.history && globalData.history.length > 0) {
    const lastWorkoutDay = globalData.history[0].workoutDay;
    if (lastWorkoutDay) {
      const daySelect = document.getElementById('workoutDay');
      for (let opt of daySelect.options) {
        if (opt.value === lastWorkoutDay) {
          daySelect.value = lastWorkoutDay;
          break;
        }
      }
    }
  }

  document.getElementById('workoutDay').addEventListener('change', () => {
    isPlateauBreakerActive = false;
    updatePlateauBreakerUI();
    updateExerciseDropdown();
  });
  
  document.getElementById('exerciseSelect').addEventListener('change', function() {
    isPlateauBreakerActive = false;
    updatePlateauBreakerUI();
    updateProgressionAdvice();
    checkTimedExercise();
    updateExerciseFormPreview();
  });

  ['sleep', 'stress', 'joints'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateProgressionAdvice);
  });

  document.getElementById('historySearch').addEventListener('input', toggleClearSearchBtn);

  updateExerciseDropdown(true); 
  evaluatePhysiqueBalance();
  renderWeeklyVolumeTracker();
  renderHistoryList();
  initChartDropdown();
  updateExerciseFormPreview();
}

function showToast(message) {
  const toastEl = document.getElementById('successToast');
  const toastMsg = document.getElementById('toastMessage');
  toastMsg.textContent = message;
  
  if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
  } else {
    console.log("Toast Notice:", message);
  }
}

function toggleClearSearchBtn() {
  const searchInput = document.getElementById('historySearch');
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchInput && clearBtn) {
    clearBtn.style.display = searchInput.value.trim().length > 0 ? 'block' : 'none';
  }
  renderHistoryList();
}

function clearHistorySearch() {
  const searchInput = document.getElementById('historySearch');
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchInput) {
    searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    renderHistoryList();
  }
}

function togglePlateauBreaker() {
  isPlateauBreakerActive = !isPlateauBreakerActive;
  updatePlateauBreakerUI();
  updateProgressionAdvice();
}

function updatePlateauBreakerUI() {
  const btn = document.getElementById('plateauBreakerBtn');
  if (!btn) return;
  if (isPlateauBreakerActive) {
    btn.classList.remove('btn-outline-danger');
    btn.classList.add('btn-danger', 'text-white', 'shadow-sm');
    btn.innerHTML = '🔄 Reset Active (80%)';
  } else {
    btn.classList.remove('btn-danger', 'text-white', 'shadow-sm');
    btn.classList.add('btn-outline-danger');
    btn.innerHTML = '🔄 Plateau Breaker';
  }
}

function updateExerciseDropdown(isInitialLoad = false) {
  const workoutDay = document.getElementById('workoutDay').value;
  const select = document.getElementById('exerciseSelect');
  select.innerHTML = '';

  let exercisesForDay = [];
  
  if (WORKOUT_SEQUENCES[workoutDay]) {
    let availableFromMap = (globalData.workoutMap && globalData.workoutMap[workoutDay]) ? globalData.workoutMap[workoutDay] : globalData.exercises;
    exercisesForDay = WORKOUT_SEQUENCES[workoutDay].filter(ex => availableFromMap.includes(ex));
    
    availableFromMap.forEach(ex => {
      if (!exercisesForDay.includes(ex)) exercisesForDay.push(ex);
    });
  } else {
    exercisesForDay = (globalData.workoutMap && globalData.workoutMap[workoutDay]) 
                        ? globalData.workoutMap[workoutDay] 
                        : globalData.exercises;
  }

  if (!exercisesForDay || exercisesForDay.length === 0) {
    exercisesForDay = globalData.exercises;
  }

  exercisesForDay.forEach(ex => {
    let opt = document.createElement('option');
    opt.value = ex;
    opt.textContent = ex;
    select.appendChild(opt);
  });

  if (isInitialLoad && globalData.history && globalData.history.length > 0) {
    const lastEx = globalData.history[0].exercise;
    if (lastEx && exercisesForDay.includes(lastEx)) {
      select.value = lastEx;
    }
  }

  updateProgressionAdvice();
  checkTimedExercise();
  updateExerciseFormPreview(); // <--- Make sure this line is here inside updateExerciseDropdown()
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
      if (isLowerBodyExercise(ex)) {
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
    analysis += `⚠️ <strong class="text-warning">Upper-Dominant Imbalance Detected!</strong> Lower body strength lags behind upper body. <b>Correction Protocol Active:</b> Forcing +5kg lower-body progression bias.`;
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

    let options = { weekday: 'short', month: 'short', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateStr;
  }
}

function roundToGymIncrement(rawWeight) {
  if (!rawWeight || isNaN(rawWeight)) return 0;
  return Math.round(rawWeight / 5) * 5;
}

function isLowerBodyExercise(exerciseName) {
  let nameLower = exerciseName.toLowerCase();
  return nameLower.includes('squat') || nameLower.includes('leg') || nameLower.includes('calf') || 
         nameLower.includes('deadlift') || nameLower.includes('hip') || nameLower.includes('thrust');
}

function isChickenLegRiskActive() {
  const lastLogs = globalData.lastLogs || {};
  let upperWeights = [];
  let lowerWeights = [];

  Object.keys(lastLogs).forEach(ex => {
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

function calculatePlates(targetWeight) {
  const barSelect = document.getElementById('barbellType');
  const barbell = barSelect ? parseFloat(barSelect.value) : 20;

  if (targetWeight <= 0) return "No load";
  if (barbell === 0) return `Total Weight: ${targetWeight} kg (Dumbbell/Machine)`;
  if (targetWeight <= barbell) return `Just the bar (${barbell} kg)`;

  let remainderPerSide = (targetWeight - barbell) / 2;
  let needsFractional = remainderPerSide % 5 !== 0;

  let loadableWeight = needsFractional ? targetWeight - 5 : targetWeight;
  let loadablePerSide = (loadableWeight - barbell) / 2;

  let availablePlates = [25, 20, 15, 10, 5];
  let breakdown = [];

  availablePlates.forEach(plate => {
    let count = Math.floor(loadablePerSide / plate);
    if (count > 0) {
      breakdown.push(`${count}x ${plate}kg`);
      loadablePerSide %= plate;
    }
  });

  let plateStr = breakdown.length > 0 ? breakdown.join(" + ") + " per side" : "Just the bar";
  let barNotice = `<span class="text-secondary">(${barbell}kg Bar)</span>`;

  if (needsFractional) {
    return `🏋️ ${plateStr} on ${barNotice} = <b>${loadableWeight}kg</b> <small class="text-info">(+2x 2.5kg plates for ${targetWeight}kg)</small>`;
  }

  return `🏋️ ${plateStr} on ${barNotice} = <b>${loadableWeight}kg total</b>`;
}

function initChartDropdown() {
  const select = document.getElementById('chartExerciseSelect');
  if (!select) return;
  select.innerHTML = '';

  let exercises = Object.keys(globalData.lastLogs || {});
  if (exercises.length === 0 && globalData.history) {
    exercises = [...new Set(globalData.history.map(item => item.exercise))];
  }

  exercises.forEach(ex => {
    let opt = document.createElement('option');
    opt.value = ex;
    opt.textContent = ex;
    select.appendChild(opt);
  });

  if (globalData.history && globalData.history.length > 0) {
    let lastLoggedEx = globalData.history[0].exercise;
    if (exercises.includes(lastLoggedEx)) {
      select.value = lastLoggedEx;
    }
  }

  renderProgressChart();
}

function renderProgressChart() {
  const exerciseSelect = document.getElementById('chartExerciseSelect');
  if (!exerciseSelect || !exerciseSelect.value) return;
  
  const selectedEx = exerciseSelect.value.toLowerCase();
  const history = globalData.history || [];

  let exerciseLogs = history
    .filter(item => item.exercise && item.exercise.toLowerCase() === selectedEx)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let labels = exerciseLogs.map(item => {
    try {
      let d = new Date(item.date);
      return isNaN(d) ? item.date : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return item.date;
    }
  });

  let weights = exerciseLogs.map(item => item.weight || 0);

  const ctx = document.getElementById('progressChart').getContext('2d');
  
  if (myProgressChart) {
    myProgressChart.destroy();
  }

  if (exerciseLogs.length === 0) {
    labels = ['No Data'];
    weights = [0];
  }

  myProgressChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Working Weight (kg)',
        data: weights,
        borderColor: '#C8102E',
        backgroundColor: 'rgba(200, 16, 46, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointBackgroundColor: '#FFE500',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#9CA3AF', font: { size: 10 } },
          grid: { color: '#27272A' }
        },
        y: {
          ticks: { color: '#9CA3AF', font: { size: 10 } },
          grid: { color: '#27272A' },
          beginAtZero: true
        }
      }
    }
  });
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
    let coachBadge = item.sleep ? `<div class="text-xtreme-gold mt-1" style="font-size: 0.78rem;">💤 Sleep: ${item.sleep} | ⚡ Stress: ${item.stress} | 🛡️ Phase: ${item.phase}</div>` : '';
    let cleanReps = (item.reps || "").toString().replace(/^'/, '');
    
    html += `
      <div class="list-group-item bg-transparent text-light border-secondary py-3 px-1">
        <div class="d-flex justify-content-between align-items-start mb-1">
          <div>
            <span class="fw-bold text-xtreme-red fs-6">${item.exercise}</span> 
            <span class="small fw-semibold" style="color: #cbd5e1;">(${item.workoutDay})</span>
          </div>
          <div class="btn-group btn-group-sm flex-shrink-0">
            <button class="btn btn-outline-warning py-1 px-2" style="font-size: 0.75rem;" onclick='editLogEntry(${JSON.stringify(item)})'>Edit</button>
            <button class="btn btn-outline-danger py-1 px-2" style="font-size: 0.75rem;" onclick="deleteLogEntry(${item.rowIndex})">Del</button>
          </div>
        </div>
        <div class="text-light small fw-medium" style="color: #e2e8f0 !important;">
          📅 ${cleanDate} &nbsp;|&nbsp; 🏋️ <b>${item.weight}kg</b> &nbsp;|&nbsp; 🔢 Sets: ${item.sets} &nbsp;|&nbsp; Reps: [${cleanReps}]
        </div>
        ${coachBadge}
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
  document.getElementById('reps').value = (item.reps || "").toString().replace(/^'/, '');
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
  updateExerciseDropdown(true);
}

function deleteLogEntry(rowIndex) {
  pendingDeleteRowIndex = rowIndex;
  const history = globalData.history || [];
  const item = history.find(h => h.rowIndex === rowIndex);
  const exerciseName = item ? item.exercise : `Row ${rowIndex}`;

  const container = document.getElementById('historyContainer');
  const confirmationHtml = `
    <div id="deleteConfirmBanner" class="alert alert-danger bg-dark border-danger text-light p-3 mb-3 small">
      <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div>
          <span>🗑️ Delete entry for <strong class="text-white">${exerciseName}</strong>?</span>
        </div>
        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-sm btn-danger px-3 py-1 fw-bold" onclick="confirmDelete()">Yes, Delete</button>
          <button class="btn btn-sm btn-outline-secondary px-3 py-1 text-light border-secondary" onclick="cancelDeletePrompt()">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  let existingBanner = document.getElementById('deleteConfirmBanner');
  if (existingBanner) existingBanner.remove();
  
  container.insertAdjacentHTML('beforebegin', confirmationHtml);
}

function confirmDelete() {
  if (pendingDeleteRowIndex === null) return;
  const rowIndex = pendingDeleteRowIndex;
  cancelDeletePrompt();

  fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: "delete", rowIndex: rowIndex })
  })
  .then(res => res.json())
  .then(res => {
    showToast(res.message || "Entry deleted successfully!");
    if (editingRowIndex === rowIndex) cancelEdit();
    fetchData();
  })
  .catch(err => {
    showToast("Error deleting entry: " + err);
  });
}

function cancelDeletePrompt() {
  pendingDeleteRowIndex = null;
  let banner = document.getElementById('deleteConfirmBanner');
  if (banner) banner.remove();
}

function isCompoundExercise(exerciseName) {
  let nameLower = exerciseName.toLowerCase();
  return nameLower.includes('squat') || 
         nameLower.includes('bench') || 
         nameLower.includes('press') || 
         nameLower.includes('row') || 
         nameLower.includes('deadlift') || 
         nameLower.includes('pull-up') || 
         nameLower.includes('pulldown') || 
         nameLower.includes('thrust') || 
         nameLower.includes('lunge');
}

function updateProgressionAdvice() {
  const exercise = document.getElementById('exerciseSelect').value.trim();
  let last = globalData.lastLogs[exercise] || null;
  
  if (!last && globalData.history && globalData.history.length > 0) {
    last = globalData.history.find(h => h.exercise && h.exercise.trim().toLowerCase() === exercise.toLowerCase());
  }
  
  const sleep = document.getElementById('sleep').value;
  const stress = document.getElementById('stress').value;
  const joints = document.getElementById('joints').value;
  const phase = document.getElementById('phase').value;

  const box = document.getElementById('suggestionText');
  const compound = isCompoundExercise(exercise);
  
  let defaultSets = compound ? 4 : 3;
  let minRepTarget = compound ? 6 : 10;
  let maxRepCeiling = compound ? 10 : 15;
  let defaultRepsStr = compound ? "8/8/8/8" : "12/12/12";

  let targetSets = defaultSets;
  let targetReps = defaultRepsStr;
  let targetWeight = 20;
  let rationale = "";

  const chickenLegActive = isChickenLegRiskActive();
  const isLower = isLowerBodyExercise(exercise);

  if (!last) {
    rationale = `No prior logs found. Starting baseline for this ${compound ? 'Compound (4 sets, 6–10 reps)' : 'Isolation (3 sets, 10–15 reps)'} movement.`;
    currentPrescription = { weight: targetWeight, sets: targetSets, reps: defaultRepsStr, rir: 2 };
  } else {
    let lastWeight = last.weight || 0;
    let lastSets = last.sets || defaultSets;
    let rawReps = (last.reps || defaultRepsStr).toString().replace(/^'/, '');
    
    let repSets = rawReps.split('/').map(r => parseInt(r.trim()) || 0);
    let hitCeilingAcrossAllSets = repSets.length > 0 && repSets.every(r => r >= maxRepCeiling);

    targetWeight = roundToGymIncrement(lastWeight);
    targetSets = lastSets;

    if (isPlateauBreakerActive) {
      targetSets = compound ? 4 : 3;
      let resetRaw = lastWeight * 0.8;
      targetWeight = roundToGymIncrement(resetRaw);
      if (targetWeight <= 0) targetWeight = 5;
      targetReps = Array(targetSets).fill(minRepTarget).join('/');
      rationale = `🔄 <strong class="text-danger">Plateau Breaker Active:</strong> Resetting sets to ${targetSets}, weight to ~80% (${targetWeight}kg), and reps to [${targetReps}].`;
    } else if (phase.includes("Deload")) {
      targetWeight = Math.max(0, targetWeight - 5);
      targetSets = Math.max(2, targetSets - 1);
      targetReps = rawReps;
      rationale = `🛌 <b>Deload Phase:</b> Dropped down one 5kg plate (${targetWeight}kg) with lower volume for active recovery.`;
    } else if (joints === "Mild Tweak") {
      targetWeight = Math.max(0, targetWeight - 5);
      targetReps = rawReps;
      rationale = `🛡️ <b>Joint Safety Mode:</b> Reduced by one 5kg plate (${targetWeight}kg) due to reported discomfort.`;
    } else if (sleep === "Poor" || stress === "High") {
      targetWeight = roundToGymIncrement(lastWeight);
      targetReps = rawReps;
      rationale = `⚠️ <b>Fatigue Flag:</b> Holding weight steady at ${targetWeight}kg. Focus on clean execution within your target range.`;
    } else if (chickenLegActive && isLower && last.rir <= 2) {
      targetWeight = roundToGymIncrement(lastWeight + 5);
      targetReps = Array(targetSets).fill(minRepTarget).join('/');
      rationale = `⚖️ <strong class="text-warning">Auto-Balancing Boost:</strong> Upper-dominant asymmetry detected! Forcing +5kg plate jump on lower body to <b>${targetWeight}kg</b>.`;
    } else if (hitCeilingAcrossAllSets && last.rir <= 2) {
      targetWeight = roundToGymIncrement(lastWeight + 5);
      targetReps = Array(targetSets).fill(minRepTarget).join('/');
      rationale = `🚀 <strong class="text-success">Rep Ceiling Reached!</strong> Stepping up to <b>${targetWeight}kg</b>.`;
    } else {
      targetWeight = roundToGymIncrement(lastWeight);
      targetReps = rawReps;
      rationale = `📌 <strong class="text-warning">Rep-Range Progression:</strong> Hold at ${targetWeight}kg. Push your reps towards <b>${maxRepCeiling}</b>.`;
    }

    currentPrescription = { weight: targetWeight, sets: targetSets, reps: targetReps, rir: last.rir <= 1 ? 2 : last.rir };
  }

  let plateHint = currentPrescription.weight > 0 ? `
    <div class="mt-2 pt-2 border-top border-secondary border-opacity-25 text-warning fw-medium" style="font-size: 0.8rem;">
      🔩 <b>Plate Setup:</b> ${calculatePlates(currentPrescription.weight)}
    </div>` : '';

  let html = `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <span class="badge bg-dark border border-warning text-xtreme-gold font-monospace px-2 py-1" style="font-size: 0.8rem;">
        🎯 Prescribed: ${currentPrescription.weight} kg
      </span>
      <span class="badge bg-secondary text-light px-2 py-1" style="font-size: 0.75rem;">
        ${currentPrescription.sets} Sets
      </span>
      <span class="badge bg-secondary text-light px-2 py-1" style="font-size: 0.75rem;">
        Reps: [${currentPrescription.reps}]
      </span>
      <span class="badge bg-outline-secondary text-muted px-2 py-1" style="font-size: 0.7rem;">
        ${compound ? 'Compound (6–10)' : 'Isolation (10–15)'}
      </span>
    </div>
    <div class="text-light mt-1" style="font-size: 0.825rem;">
      ${rationale}
    </div>
    ${plateHint}
  `;
  box.innerHTML = html;
}

function applyPrescription() {
  if (!currentPrescription) return;
  document.getElementById('weight').value = currentPrescription.weight;
  document.getElementById('sets').value = currentPrescription.sets;
  document.getElementById('reps').value = currentPrescription.reps;
  document.getElementById('rir').value = currentPrescription.rir;
  
  const btn = document.getElementById('applyPrescriptionBtn');
  btn.textContent = '✅ Applied!';
  setTimeout(() => { btn.textContent = '📥 Apply Target'; }, 1500);
}

function startRestTimer(seconds) {
  clearInterval(restTimerInterval);
  const display = document.getElementById('timerDisplay');
  const widget = document.getElementById('restTimerWidget');
  widget.style.display = 'block';
  
  let durationMs = seconds * 1000;
  let startTime = performance.now();
  let endTime = startTime + durationMs;
  
  function updateTimer() {
    let now = performance.now();
    let remainingMs = endTime - now;
    let remainingSec = Math.ceil(remainingMs / 1000);
    
    if (remainingSec <= 0) {
      clearInterval(restTimerInterval);
      display.textContent = "Time to lift! 🔥";
    } else {
      let m = Math.floor(remainingSec / 60);
      let s = remainingSec % 60;
      display.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }
  }
  
  updateTimer();
  restTimerInterval = setInterval(updateTimer, 250);
}

function stopRestTimer() {
  clearInterval(restTimerInterval);
  document.getElementById('restTimerWidget').style.display = 'none';
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
    reps: "'" + document.getElementById('reps').value.trim(),
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
      showToast(res.message || "Workout saved successfully!");
      isPlateauBreakerActive = false;
      updatePlateauBreakerUI();
      cancelEdit(); 
      fetchData();  
      btn.disabled = false;
      
      startRestTimer(90);
      
      // 👇 ADD THIS SCROLL LINE HERE:
      document.getElementById('restTimerWidget').scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
  .catch(() => {
    let queue = JSON.parse(localStorage.getItem('offline_workout_queue') || '[]');
    queue.push(payload);
    localStorage.setItem('offline_workout_queue', JSON.stringify(queue));
    
    showToast("⚠️ Network offline. Saved to local queue!");
    btn.disabled = false;
    btn.textContent = editingRowIndex ? 'Update Log Entry' : 'Log Set & Update Stats';
    cancelEdit();
  });
});

const EXERCISE_MUSCLE_MAP = {
  "Bench Press": "Chest",
  "Incline Dumbell Press": "Chest",
  "Barbell Row": "Back",
  "Pull-ups / Lat Pulldown": "Back",
  "Seated Cable Row": "Back",
  "Face Pull": "Back",
  "Overhead Press": "Shoulders",
  "Dumbell Shoulder Press": "Shoulders",
  "Lateral Raises": "Shoulders",
  "Bicep Curl": "Arms",
  "Tricep Pushdown": "Arms",
  "Back Squat": "Quads",
  "Front Squat / Leg Press": "Quads",
  "Walking Lunges": "Quads",
  "Bulgarian Split Squat": "Quads",
  "Romanian Deadlift": "Hamstrings/Glutes",
  "Deadlift": "Hamstrings/Glutes",
  "Hamstring Curl": "Hamstrings/Glutes",
  "Hip Thrust / Glute Bridge": "Hamstrings/Glutes",
  "Calf Raises": "Calves",
  "Plank": "Core",
  "Hanging Leg Raises": "Core",
  "Ab Wheel": "Core",
  "Cable Woodchop": "Core"
};

function renderWeeklyVolumeTracker() {
  const container = document.getElementById('volumeTrackerContainer');
  const badge = document.getElementById('cycleWeekBadge');
  if (!container) return;

  if (badge && globalData.cycleWeek) {
    badge.textContent = `Cycle Week ${globalData.cycleWeek} (${globalData.currentPhase || 'Intensification'})`;
  }

  const history = globalData.history || [];
  
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  let volumeMap = {
    "Chest": 0,
    "Back": 0,
    "Shoulders": 0,
    "Quads": 0,
    "Hamstrings/Glutes": 0,
    "Arms": 0
  };

  history.forEach(item => {
    if (!item.date) return;
    let logDate = new Date(item.date);
    if (!isNaN(logDate) && logDate >= startOfWeek) {
      let muscle = EXERCISE_MUSCLE_MAP[item.exercise];
      let sets = parseInt(item.sets) || 0;
      if (muscle && volumeMap[muscle] !== undefined) {
        volumeMap[muscle] += sets;
      }
    }
  });

  let totalActiveSets = Object.values(volumeMap).reduce((a, b) => a + b, 0);
  if (totalActiveSets === 0 && history.length > 0) {
    history.slice(0, 15).forEach(item => {
      let muscle = EXERCISE_MUSCLE_MAP[item.exercise];
      let sets = parseInt(item.sets) || 0;
      if (muscle && volumeMap[muscle] !== undefined) {
        volumeMap[muscle] += sets;
      }
    });
  }

  let html = '';
  let targetMin = 10;
  let targetMax = 20;

  Object.keys(volumeMap).forEach(muscle => {
    let sets = volumeMap[muscle];
    let percentage = Math.min(100, Math.round((sets / targetMax) * 100));
    
    let statusText = '(Optimal)';
    let barClass = 'progress-bar-crimson';
    let textClass = 'status-label-optimal';

    if (sets < targetMin) {
      statusText = '(Under-Target)';
      barClass = 'progress-bar-yellow';
      textClass = 'status-label-under';
    } else if (sets > targetMax) {
      statusText = '(High Fatigue Warning)';
      barClass = 'progress-bar-crimson';
      textClass = 'status-label-over';
    }

    html += `
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="fw-bold text-white fs-6">${muscle}</span>
          <div>
            <span class="fw-bold text-white fs-6">${sets} / ${targetMax} sets</span>
            <span class="status-label ${textClass} ms-1" style="font-size: 0.78rem;">${statusText}</span>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="${barClass}" style="width: ${percentage}%;"></div>
        </div>
      </div>
    `;
  });

  let laggingMuscle = Object.keys(volumeMap).reduce((minMuscle, m) => volumeMap[m] < volumeMap[minMuscle] ? m : minMuscle, Object.keys(volumeMap)[0]);

  html += `
    <div class="pt-2 mt-3 border-top border-secondary border-opacity-25 text-light small" style="font-size: 0.8rem; line-height: 1.4;">
      💡 <b class="text-xtreme-gold">Coach Tip:</b> ${laggingMuscle} has the lowest volume this week (${volumeMap[laggingMuscle]} sets). Consider prioritizing it on your next split day.
    </div>
  `;

  container.innerHTML = html;
}



function updateExerciseFormPreview() {
  const selectedExercise = document.getElementById('exerciseSelect').value;
  const previewCard = document.getElementById('exercisePreviewCard');
  const gifImg = document.getElementById('exerciseGifPreview');

  let gifUrl = null;

  // 1. Check if the Reference tab from your spreadsheet has an image URL for this exercise
  if (globalData && globalData.reference && globalData.reference[selectedExercise]) {
    gifUrl = globalData.reference[selectedExercise].image;
  }

  // 2. Fallback to hardcoded map if not present in globalData
  if (!gifUrl && typeof EXERCISE_GIF_MAP !== 'undefined') {
    gifUrl = EXERCISE_GIF_MAP[selectedExercise];
  }

  if (gifUrl && gifUrl.trim() !== "") {
    gifImg.src = gifUrl;
    previewCard.style.display = 'block';
  } else {
    previewCard.style.display = 'none';
  }
}
