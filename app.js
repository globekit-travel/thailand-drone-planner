const steps = [
  {
    id: "drone",
    title: "Drone Basics",
    fields: ["model"],
    selects: {
      weight: ["Select", "Under 250g", "250g or more", "Not sure"]
    }
  },
  {
    id: "caat",
    title: "CAAT Registration",
    fields: ["appNumber", "date", "notes"]
  },
  {
    id: "nbtc",
    title: "NBTC Registration",
    fields: ["regNumber", "notes"]
  },
  {
    id: "insurance",
    title: "Insurance",
    fields: ["provider", "policyNumber", "expiry", "contact", "notes"]
  },
  {
    id: "airspace",
    title: "Airspace / FlySafe",
    fields: [],
    selects: {
      checked: ["Select", "Yes", "No", "Not sure"]
    }
  },
  {
    id: "context",
    title: "Where You Plan to Fly",
    optional: true,
    fields: ["location", "notes"]
  }
];

const labels = {
  model: "Drone model",
  weight: "Weight category",
  appNumber: "Application number",
  date: "Submission date",
  regNumber: "Registration number",
  provider: "Provider",
  policyNumber: "Policy number",
  expiry: "Expiration date",
  contact: "Emergency / claims contact",
  checked: "Checked zones",
  location: "Primary location",
  notes: "Notes"
};

const container = document.getElementById("steps");

steps.forEach(step => {
  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <h3>${step.title}</h3>
    ${step.optional ? `<p class="note">This helps you remember your plans. It does not affect readiness.</p>` : ""}

    <label>Completion status</label>
    <select id="${step.id}_status">
      <option>Not started</option>
      <option>In progress</option>
      <option>Done</option>
      <option>Not sure</option>
    </select>

    ${step.fields.map(f => `
      <label>${labels[f] || f}</label>
      ${f === "notes"
        ? `<textarea id="${step.id}_${f}" placeholder="${labels[f] || f}"></textarea>`
        : `<input id="${step.id}_${f}" placeholder="${labels[f] || f}">`
      }
    `).join("")}

    ${step.selects ? Object.keys(step.selects).map(key => `
      <label>${labels[key] || key}</label>
      <select id="${step.id}_${key}">
        ${step.selects[key].map(opt => `<option>${opt}</option>`).join("")}
      </select>
    `).join("") : ""}
  `;

  container.appendChild(div);
});

function getData() {
  const data = {};

  steps.forEach(step => {
    data[step.id] = {};
    data[step.id].status = document.getElementById(`${step.id}_status`).value;

    step.fields.forEach(f => {
      data[step.id][f] = document.getElementById(`${step.id}_${f}`).value.trim();
    });

    if (step.selects) {
      Object.keys(step.selects).forEach(key => {
        data[step.id][key] = document.getElementById(`${step.id}_${key}`).value;
      });
    }
  });

  return data;
}

function saveData() {
  localStorage.setItem("planner", JSON.stringify(getData()));
}

function loadData() {
  const data = JSON.parse(localStorage.getItem("planner") || "{}");

  steps.forEach(step => {
    if (!data[step.id]) return;

    document.getElementById(`${step.id}_status`).value = data[step.id].status || "Not started";

    step.fields.forEach(f => {
      document.getElementById(`${step.id}_${f}`).value = data[step.id][f] || "";
    });

    if (step.selects) {
      Object.keys(step.selects).forEach(key => {
        document.getElementById(`${step.id}_${key}`).value = data[step.id][key] || "Select";
      });
    }
  });
}

document.addEventListener("input", saveData);
document.addEventListener("change", saveData);
loadData();

function getStepState(step, data) {
  if (step.optional) return "optional";

  const s = data[step.id];
  const status = s.status;

  if (status === "Not sure") return "uncertain";
  if (status === "Not started") return "incomplete";
  if (status !== "Done") return "incomplete";

  if (step.id === "drone") {
    return (
      s.model &&
      s.weight &&
      s.weight !== "Select" &&
      s.weight !== "Not sure"
    ) ? "complete" : "incomplete";
  }

  if (step.id === "caat") {
    return s.appNumber || s.date ? "complete" : "incomplete";
  }

  if (step.id === "nbtc") {
    return s.regNumber ? "complete" : "incomplete";
  }

  if (step.id === "insurance") {
    return s.provider && s.expiry ? "complete" : "incomplete";
  }

  if (step.id === "airspace") {
    return s.checked === "Yes" ? "complete" : "incomplete";
  }

  return "incomplete";
}

function evaluatePlan(data) {
  const states = steps
    .filter(step => !step.optional)
    .map(step => ({
      id: step.id,
      title: step.title,
      state: getStepState(step, data)
    }));

  const uncertain = states.some(s => s.state === "uncertain");
  const incomplete = states.filter(s => s.state === "incomplete");

  if (uncertain || incomplete.length > 1) {
    return {
      status: "Not Ready",
      className: "bad",
      states
    };
  }

  if (incomplete.length === 1) {
    return {
      status: "Needs Attention",
      className: "warn",
      states
    };
  }

  return {
    status: "Ready",
    className: "ready",
    states
  };
}

function checklistItem(step) {
  const map = {
    drone: "Complete drone basics",
    caat: "Complete CAAT registration details",
    nbtc: "Confirm NBTC registration",
    insurance: "Add or confirm insurance details",
    airspace: "Check flight zones in DJI FlySafe"
  };

  return map[step.id] || `Review ${step.title}`;
}

function buildReportHTML(data, forExport = false) {
  const result = evaluatePlan(data);
  const attentionSteps = result.states.filter(s => s.state !== "complete");

  const checklist = attentionSteps.length
    ? `<ul>${attentionSteps.map(s => `<li>${checklistItem(s)}</li>`).join("")}</ul>`
    : `<p>No missing planning steps detected.</p>`;

  const summary = steps.map(step => {
    const s = data[step.id];

    const fieldRows = [
      ...step.fields.map(f => ({ key: f, value: s[f] })),
      ...(step.selects ? Object.keys(step.selects).map(key => ({ key, value: s[key] })) : [])
    ]
      .filter(item => item.value && item.value !== "Select")
      .map(item => `<li><strong>${labels[item.key] || item.key}:</strong> ${escapeHTML(item.value)}</li>`)
      .join("");

    return `
      <section class="report-section">
        <h3>${step.title}</h3>
        <p><strong>Status:</strong> ${escapeHTML(s.status || "Not started")}</p>
        ${fieldRows ? `<ul>${fieldRows}</ul>` : `<p>No details added.</p>`}
      </section>
    `;
  }).join("");

  const disclaimer = `
    <p class="note">
      This plan is a personal planning aid only. You are responsible for verifying current requirements with official sources before traveling or flying. GlobeKit does not provide legal clearance or permission to operate a drone.
    </p>
  `;

  return `
    <div class="export-header">
    <h2 class="export-title">Thailand Drone Trip Plan</h2>
</div>

<p class="export-date">
  Created on: ${new Date().toLocaleDateString()}
</p>

<p class="export-brand">
  Created with <strong>GlobeKit</strong> -
  <a href="https://globekit.net/guides/should-you-bring-a-drone-to-thailand-in-2026/" target="_blank">
    View the full Thailand drone guide
  </a>
</p>

      <div class="status ${result.className}">
        ${result.status}
      </div>

      <h3>What still needs attention</h3>
      ${checklist}

      <h3>Trip Summary</h3>
      ${summary}

      ${disclaimer}

      ${forExport ? "" : `
        <div class="card travel-panel">
          <h3>
            ${result.status === "Ready"
              ? "Your plan is ready for travel."
              : "When your plan is ready for travel:"
            }
          </h3>

          <button onclick="download()">Download Travel Plan</button>

<p>
  ${result.status === "Ready"
    ? "Save this file somewhere you can access during your trip: phone, email, or cloud storage."
    : "Complete the remaining steps, then export your plan for easy access during your trip."
  }
</p>

<p><a href="mailto:?subject=Thailand Drone Trip Plan&body=I created a Thailand drone trip plan. Attach the downloaded HTML file to this email so it is easy to access during travel.">Email this plan</a></p>
<p><a href="https://drive.google.com/" target="_blank">Open Google Drive</a></p>
</div>
      `}
    </div>
  `;
}

document.getElementById("generateBtn").addEventListener("click", () => {
  const data = getData();
  saveData();

  const output = document.getElementById("output");
  output.innerHTML = "";
  output.innerHTML = buildReportHTML(data, false);
});

function download() {
  const data = getData();
  const report = buildReportHTML(data, true);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Thailand Drone Trip Plan</title>
<style>
body {
  font-family: Arial, Helvetica, sans-serif;
  color: #1F2937;
  background: #F7F8FA;
  padding: 20px;
  max-width: 800px;
  margin: auto;
  line-height: 1.5;
}
.status {
  font-weight: bold;
  padding: 12px;
  margin: 12px 0;
  font-size: 18px;
}
.ready { color: #16A34A; }
.warn { color: #D97706; }
.bad { color: #DC2626; }
.report-section {
  border-top: 1px solid #ddd;
  padding-top: 12px;
  margin-top: 12px;
}
.note {
  font-size: 14px;
  color: #4B5563;
}
.export-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.export-logo {
  height: 30px;
  width: auto;
}

.export-title {
  color: #2563EB;
  margin: 0;
}

.export-brand {
  font-size: 15px;
  color: #6B7280;
  margin-bottom: 20px;
}

.export-brand a {
  color: #2563EB;
  text-decoration: none;
}

.export-brand a:hover {
  text-decoration: underline;
}
</style>
</head>
<body>
${report}
</body>
</html>
  `;

  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "thailand-drone-trip-plan.html";
  a.click();
}

document.getElementById("clearBtn").onclick = () => {
  const confirmed = confirm("Clear all saved planner data?");
  if (!confirmed) return;

  localStorage.removeItem("planner");

  steps.forEach(step => {
    document.getElementById(`${step.id}_status`).value = "Not started";

    step.fields.forEach(f => {
      document.getElementById(`${step.id}_${f}`).value = "";
    });

    if (step.selects) {
      Object.keys(step.selects).forEach(key => {
        document.getElementById(`${step.id}_${key}`).value = "Select";
      });
    }
  });

  document.getElementById("output").innerHTML = "";
};

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}