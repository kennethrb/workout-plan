const API_URL = "https://script.google.com/macros/s/AKfycbxZNsbt0S6EYYqbma4_nRMjNJFt4d-84qt1noBVy97ol2wuuiVZzs8xBSJEn4TRlekj/exec";

let globalData = {};
let editingRowIndex = null;

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

  document.getElementById('workoutDay').addEventListener('change', updateExerciseDropdown);
  document.getElementById('exerciseSelect').addEventListener('change', function() {
    updateProgressionAdvice();
    checkTimedExercise();
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
    html += `
      <div class="list-group-item bg-transparent text-light border-secondary d-flex justify-content-between align-items-center py-2 px-0">
        <div class="small text-truncate me-2">
          <span class="fw-bold text-primary">${item.exercise}</span> <span class="text-muted">(${item.workoutDay})</span><br>
          <span class="text-light">${cleanDate} | Wt: ${item.weight}kg | Sets: ${item.sets} | Reps: ${item.reps} | RIR: ${item.rir}</span>
        </div>
        <div class="btn-group btn-group-sm flex-shrink-0">
          <button class="btn btn-outline-warning py-0 px-2" onclick='editLogEntry(${JSON.stringify(item)})'>Edit</button>
          <button class="btn btn-outline-danger py-0 px-2" onclick="deleteLogEntry(${item.rowIndex})">Del</button>
        </div>
      </div>
    `;
  });
  html += '</div>';

  if (!searchQuery && filteredHistory.length > 5) {
    html += `<div class="text-center mt-2"><small class="text-muted">Showing latest 5 of ${filteredHistory.length} entries. Use search above to find more.</small></div>`;
  }

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

  document.getElementById('formTitle').textContent = `Edit Log Entry (Row ${item.rowIndex})`;
  document.getElementById('submitBtn').textContent = 'Update Log Entry';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingRowIndex = null;
  document.getElementById('workoutForm').reset();
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
    if (editingRowIndex === rowIndex) {
      cancelEdit();
    }
    fetchData();
  })
  .catch(err => {
    alert("Error deleting entry: " + err);
    console.error(err);
  });
}

function updateProgressionAdvice() {
  const exercise = document.getElementById('exerciseSelect').value;
  const ref = globalData.references[exercise] || {};
  const last = globalData.lastLogs[exercise] || null;
  
  const box = document.getElementById('suggestionText');
  
  let targetSets = ref.sets || '?';
  let targetReps = ref.repsTarget || '?';
  let targetRir = ref.rirTarget || '1-2';
  let targetWt = ref.weightTarget ? `${ref.weightTarget} kg` : 'N/A';

  let html = `<div class="mb-1 text-info">🎯 <b>Reference Target:</b> ${targetSets} sets × ${targetReps} reps @ RIR ${targetRir} (Target Wt: ${targetWt})</div>`;
  
  if (!last) {
    html += `<div class="text-warning mt-1">No prior logs found. Start with your baseline target!</div>`;
  } else {
    let cleanLastDate = formatDateString(last.date);
    html += `<div class="mb-1">📊 <b>Last Session (${cleanLastDate}):</b> ${last.weight} ${last.weightUnit === 'Bodyweight' ? '(BW)' : 'kg'}, ${last.sets} sets, Reps/Sec: [${last.reps}], RIR: ${last.rir}</div>`;
    
    let suggestion = "";
    if (last.rir <= 2) {
      suggestion = `🚀 <strong class="text-success">Recommendation: Ready to INCREASE WEIGHT / TIME!</strong>`;
    } else if (last.rir > 2) {
      suggestion = `📌 <strong class="text-warning">Recommendation: Hold weight & Add Reps/Sec.</strong>`;
    } else {
      suggestion = `📈 <strong class="text-info">Recommendation: Progress steadily.</strong>`;
    }
    html += `<div class="mt-2 text-light">${suggestion}</div>`;
  }
  box.innerHTML = html;
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
    rir: parseInt(document.getElementById('rir').value) || 0
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
    console.error("Detailed save error:", err);
    btn.disabled = false;
    btn.textContent = editingRowIndex ? 'Update Log Entry' : 'Log Set & Update Stats';
  });
});
