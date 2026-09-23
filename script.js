const PROMPT_FILES = {
  cycle: "assets/testCycleAnalysis.txt",
  investigate: "assets/investigateIssue.txt",
  report: "assets/bugReportGen.txt",
  duplicate: "assets/checkDuplicatedBugs.txt",
};

const WORKFLOWS = {
  cycle: {
    required: ["testCycleInput"],
    labels: { testCycleInput: "Test Cycle Description" },
    sections: [
      ["TEST CYCLE", "testCycleInput"],
    ],
  },
  investigate: {
    required: ["testCycleInput", "issueInput"],
    labels: {
      testCycleInput: "Test Cycle Description",
      issueInput: "Issue Description",
    },
    sections: [
      ["TEST CYCLE", "testCycleInput"],
      ["ISSUE", "issueInput"],
    ],
  },
  report: {
    required: ["testCycleInput", "issueInput"],
    labels: {
      testCycleInput: "Test Cycle Description",
      issueInput: "Bug Description / Issue Information",
    },
    sections: [
      ["TEST CYCLE", "testCycleInput"],
      ["BUG DESCRIPTION / ISSUE INFORMATION", "issueInput"],
    ],
  },
  duplicate: {
    required: ["testCycleInput", "bugReportInput", "knownBugsInput"],
    labels: {
      testCycleInput: "Test Cycle Description",
      bugReportInput: "New Bug Report",
      knownBugsInput: "Previous / Known Bugs",
    },
    sections: [
      ["NEW BUG REPORT", "bugReportInput"],
      ["TEST CYCLE", "testCycleInput"],
      ["PREVIOUS BUGS", "knownBugsInput"],
    ],
  },
};

const prompts = {};
const generatedPrompts = {};
const trackedInputs = [
  "testCycleInput",
  "issueInput",
  "bugReportInput",
  "knownBugsInput",
];

function element(id) {
  return document.getElementById(id);
}

function normalizeText(value) {
  return value.trim().replace(/\r\n/g, "\n");
}

function buildPrompt(workflowName) {
  const workflow = WORKFLOWS[workflowName];
  const dataSections = workflow.sections.map(([heading, inputId]) => {
    const value = normalizeText(element(inputId).value);
    return `\n\n---\n\n# ${heading}\n\n${value}`;
  });

  return `${prompts[workflowName].trim()}${dataSections.join("")}\n`;
}

function setMessage(workflowName, message, success = false) {
  const messageElement = element(`${workflowName}Message`);
  messageElement.textContent = message;
  messageElement.classList.toggle("success", success);
}

function validateWorkflow(workflowName) {
  const workflow = WORKFLOWS[workflowName];
  const missingInputs = workflow.required.filter((inputId) => {
    const input = element(inputId);
    const isMissing = !normalizeText(input.value);
    input.classList.toggle("invalid", isMissing);
    return isMissing;
  });

  if (missingInputs.length === 0) {
    return true;
  }

  const missingLabels = missingInputs.map((inputId) => workflow.labels[inputId]);
  setMessage(workflowName, `Thiếu dữ liệu: ${missingLabels.join(", ")}.`);
  element(missingInputs[0]).focus();
  return false;
}

function generatePrompt(workflowName) {
  if (!prompts[workflowName]) {
    setMessage(workflowName, "Prompt gốc chưa tải xong. Hãy thử lại sau.");
    return;
  }

  if (!validateWorkflow(workflowName)) {
    return;
  }

  const generated = buildPrompt(workflowName);
  generatedPrompts[workflowName] = generated;
  element(`${workflowName}Output`).textContent = generated;
  document.querySelector(`[data-copy="${workflowName}"]`).disabled = false;
  setMessage(workflowName, "Prompt đã sẵn sàng để copy.", true);
}

async function copyPrompt(workflowName, button) {
  const prompt = generatedPrompts[workflowName];
  if (!prompt) {
    return;
  }

  try {
    await navigator.clipboard.writeText(prompt);
    const label = button.querySelector("span");
    const previousLabel = label.textContent;
    label.textContent = "Đã copy";
    button.classList.add("copied");
    setMessage(workflowName, "Đã copy prompt vào clipboard.", true);

    window.setTimeout(() => {
      label.textContent = previousLabel;
      button.classList.remove("copied");
    }, 1600);
  } catch (error) {
    setMessage(workflowName, "Không thể truy cập clipboard. Hãy chọn nội dung output và copy thủ công.");
  }
}

function updateCharacterCount(inputId) {
  const countElement = element(inputId.replace("Input", "Count"));
  countElement.textContent = `${element(inputId).value.length.toLocaleString("vi-VN")} ký tự`;
}

function invalidateGeneratedPrompts(inputId) {
  Object.entries(WORKFLOWS).forEach(([workflowName, workflow]) => {
    if (!workflow.required.includes(inputId) || !generatedPrompts[workflowName]) {
      return;
    }

    delete generatedPrompts[workflowName];
    document.querySelector(`[data-copy="${workflowName}"]`).disabled = true;
    setMessage(workflowName, "Dữ liệu đã thay đổi. Hãy Generate prompt lại.");
  });
}

function bindEvents() {
  document.querySelectorAll("[data-generate]").forEach((button) => {
    button.addEventListener("click", () => generatePrompt(button.dataset.generate));
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyPrompt(button.dataset.copy, button));
  });

  document.querySelectorAll("[data-clear]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = element(button.dataset.clear);
      input.value = "";
      input.dispatchEvent(new Event("input"));
      input.focus();
    });
  });

  trackedInputs.forEach((inputId) => {
    const input = element(inputId);
    input.addEventListener("input", () => {
      input.classList.remove("invalid");
      updateCharacterCount(inputId);
      invalidateGeneratedPrompts(inputId);
    });
  });
}

async function loadPrompts() {
  const status = element("loadStatus");

  try {
    const entries = await Promise.all(
      Object.entries(PROMPT_FILES).map(async ([name, path]) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Không tải được ${path}`);
        }
        return [name, await response.text()];
      }),
    );

    Object.assign(prompts, Object.fromEntries(entries));
    status.classList.add("ready");
    status.innerHTML = '<span class="status-dot" aria-hidden="true"></span>4 prompt đã sẵn sàng';
  } catch (error) {
    status.classList.add("error");
    status.innerHTML = '<span class="status-dot" aria-hidden="true"></span>Không thể tải prompt';
    document.querySelectorAll("[data-generate]").forEach((button) => {
      button.disabled = true;
    });
    console.error(error);
  }
}

bindEvents();
loadPrompts();

if (window.lucide) {
  window.lucide.createIcons();
}