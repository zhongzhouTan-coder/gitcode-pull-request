export function getCreateIssueHtml(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Create Issue</title>
	<style>
		:root {
			--border: var(--vscode-panel-border, #30363d);
			--card: var(--vscode-sideBar-background, rgba(127,127,127,0.08));
			--muted: var(--vscode-descriptionForeground, #8b949e);
			--danger: var(--vscode-errorForeground, #f85149);
		}
		body {
			margin: 0;
			padding: 24px;
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-foreground);
		}
		.container {
			max-width: 920px;
			margin: 0 auto;
			display: flex;
			flex-direction: column;
			gap: 16px;
		}
		.card {
			border: 1px solid var(--border);
			border-radius: 10px;
			background: var(--card);
			padding: 18px;
		}
		h1 { margin: 0 0 8px 0; font-size: 24px; }
		.subtitle { color: var(--muted); margin: 0; }
		.form-grid {
			display: grid;
			grid-template-columns: 160px minmax(0, 1fr);
			gap: 12px 16px;
			align-items: start;
		}
		label.label {
			font-size: 13px;
			font-weight: 600;
			padding-top: 10px;
		}
		input[type="text"],
		textarea,
		select {
			width: 100%;
			box-sizing: border-box;
			padding: 9px 10px;
			border-radius: 6px;
			border: 1px solid var(--border);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			font-family: var(--vscode-font-family);
			font-size: 14px;
		}
		textarea {
			min-height: 220px;
			resize: vertical;
			font-family: var(--vscode-editor-font-family, monospace);
		}
		input:focus,
		textarea:focus,
		select:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}
		.hint {
			margin-top: 6px;
			font-size: 12px;
			color: var(--muted);
		}
		.multi-picker {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.selected-items {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			min-height: 34px;
			padding: 5px;
			border: 1px solid var(--border);
			border-radius: 8px;
			background: transparent;
		}
		.selected-chip {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			max-width: 100%;
			padding: 3px 7px;
			border: 1px solid color-mix(in srgb, var(--vscode-button-background, #2f81f7) 22%, var(--border));
			border-radius: 999px;
			background: transparent;
		}
		.selected-chip span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.selected-chip button {
			padding: 0 2px;
			background: transparent;
			color: var(--muted);
			border: none;
			font-size: 14px;
			line-height: 1;
		}
		.selected-chip button:hover,
		.selected-chip button:focus-visible {
			color: var(--vscode-foreground);
			outline: none;
		}
		.option-list {
			max-height: 140px;
			overflow: auto;
			border: 1px solid var(--border);
			border-radius: 8px;
			background: var(--card);
			box-shadow: 0 10px 28px color-mix(in srgb, #000 18%, transparent);
		}
		.option-list.hidden {
			display: none;
		}
		.option-item {
			width: 100%;
			padding: 7px 9px;
			text-align: left;
			background: transparent;
			color: var(--vscode-foreground);
			border: none;
			border-radius: 0;
		}
		.option-item:hover,
		.option-item:focus {
			background: var(--vscode-list-hoverBackground, rgba(127,127,127,0.14));
			outline: none;
		}
		.empty-options {
			padding: 8px 9px;
			color: var(--muted);
		}
		.warning-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.warning {
			padding: 10px 12px;
			border: 1px solid color-mix(in srgb, var(--vscode-editorWarning-foreground, #d29922) 28%, var(--border));
			border-radius: 8px;
			color: var(--vscode-editorWarning-foreground, #d29922);
			background: transparent;
			font-size: 13px;
		}
		.error {
			display: none;
			padding: 10px 12px;
			border: 1px solid color-mix(in srgb, var(--danger) 26%, var(--border));
			border-radius: 8px;
			color: var(--danger);
			font-size: 13px;
		}
		.actions {
			display: flex;
			gap: 10px;
			justify-content: flex-end;
		}
		button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 9px 14px;
			border-radius: 6px;
			border: 1px solid var(--border);
			cursor: pointer;
			font: inherit;
		}
		button.primary {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		button.secondary {
			background: transparent;
			color: var(--vscode-foreground);
		}
		button:disabled {
			opacity: 0.6;
			cursor: default;
		}
		.inline-row {
			display: flex;
			align-items: center;
			gap: 10px;
			min-height: 40px;
		}
		.loading {
			font-size: 13px;
			color: var(--muted);
		}
		@media (max-width: 720px) {
			.form-grid {
				grid-template-columns: 1fr;
			}
			label.label {
				padding-top: 0;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="card">
			<h1>Create Issue</h1>
			<p class="subtitle" id="repository-name">Loading repository…</p>
		</div>
		<div class="warning-list" id="warnings"></div>
		<div class="card">
			<div class="error" id="error"></div>
			<div class="form-grid">
				<label class="label" for="title">Title</label>
				<div>
					<input id="title" type="text" maxlength="255">
				</div>
				<label class="label" for="body">Description</label>
				<div>
					<textarea id="body"></textarea>
				</div>
				<label class="label" for="labels">Labels</label>
				<div>
					<div class="multi-picker">
						<input id="labels" type="text" autocomplete="off" placeholder="Search labels...">
						<div id="label-options" class="option-list hidden"></div>
						<div id="selected-labels" class="selected-items"></div>
					</div>
					<div class="hint">Select labels or type comma-separated label names.</div>
				</div>
				<label class="label" for="milestone">Milestone</label>
				<div>
					<select id="milestone">
						<option value="">No milestone</option>
					</select>
				</div>
				<label class="label" for="assignees">Assignees</label>
				<div>
					<div class="multi-picker">
						<input id="assignees" type="text" autocomplete="off" placeholder="Search members...">
						<div id="assignee-options" class="option-list hidden"></div>
						<div id="selected-assignees" class="selected-items"></div>
					</div>
					<div class="hint">Select assignees or type comma-separated usernames.</div>
				</div>
				<label class="label" for="template">Template</label>
				<div>
					<select id="template">
						<option value="">No template</option>
					</select>
				</div>
				<label class="label" for="templatePath">Template Path</label>
				<div>
					<input id="templatePath" type="text" placeholder=".gitcode/ISSUE_TEMPLATE/bug.md">
					<div class="hint">Used as <code>template_path</code> in the create issue API.</div>
				</div>
				<label class="label">Private Issue</label>
				<div class="inline-row">
					<label><input id="securityHole" type="checkbox"> Create as private issue</label>
				</div>
			</div>
		</div>
		<div class="actions">
			<span class="loading" id="submit-state"></span>
			<button class="secondary" id="cancel-button">Cancel</button>
			<button class="primary" id="submit-button">Create Issue</button>
		</div>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		let currentDefaults = null;
		const labelsInput = document.getElementById('labels');
		const labelOptions = document.getElementById('label-options');
		const selectedLabels = document.getElementById('selected-labels');
		const assigneesInput = document.getElementById('assignees');
		const assigneeOptions = document.getElementById('assignee-options');
		const selectedAssignees = document.getElementById('selected-assignees');

		function setBusy(isBusy) {
			document.getElementById('submit-button').disabled = isBusy;
			document.getElementById('cancel-button').disabled = isBusy;
			document.getElementById('submit-state').textContent = isBusy ? 'Creating issue…' : '';
		}

		function escapeHtml(value) {
			return String(value ?? '')
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		function createMultiPicker(input, optionsContainer, selectedContainer, options = {}) {
			let items = [];
			let selected = [];
			let isOpen = false;

			function splitInput(value) {
				return String(value || '')
					.split(',')
					.map(item => item.trim())
					.filter(Boolean);
			}

			function selectedKey(value) {
				return String(value || '').toLowerCase();
			}

			function renderOptions() {
				optionsContainer.classList.toggle('hidden', !isOpen);
				if (!isOpen) {
					return;
				}

				const query = input.value.trim().toLowerCase();
				const available = items.filter(item =>
					!selected.includes(item.value) &&
					(!query ||
						item.label.toLowerCase().includes(query) ||
						(item.selectedLabel || '').toLowerCase().includes(query) ||
						item.value.toLowerCase().includes(query))
				);

				if (!available.length) {
					optionsContainer.innerHTML = '<div class="empty-options">No options available</div>';
					return;
				}

				optionsContainer.innerHTML = available.map(item =>
					'<button type="button" class="option-item" data-value="' + escapeHtml(item.value) + '">' +
						escapeHtml(item.label) +
					'</button>'
				).join('');
			}

			function renderSelected() {
				selectedContainer.innerHTML = selected.map(value => {
					const item = items.find(candidate => candidate.value === value);
					const label = item ? item.selectedLabel || item.label : value;
					return '<div class="selected-chip" data-value="' + escapeHtml(value) + '">' +
						'<span title="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>' +
						'<button type="button" title="Remove" aria-label="Remove ' + escapeHtml(label) + '">&times;</button>' +
					'</div>';
				}).join('');
			}

			function render() {
				renderOptions();
				renderSelected();
			}

			function addValue(value) {
				const normalizedValue = String(value || '').trim();
				if (!normalizedValue) {
					return;
				}

				const existingKeys = new Set(selected.map(selectedKey));
				if (existingKeys.has(selectedKey(normalizedValue))) {
					input.value = '';
					render();
					input.focus();
					return;
				}

				selected = [...selected, normalizedValue];
				input.value = '';
				render();
				input.focus();
			}

			function addTypedValues() {
				const values = splitInput(input.value);
				if (!values.length) {
					return false;
				}

				values.forEach(addValue);
				return true;
			}

			function valuesWithPendingInput() {
				if (!options.allowCustom) {
					return selected;
				}

				const result = [...selected];
				const existingKeys = new Set(result.map(selectedKey));
				for (const value of splitInput(input.value)) {
					const key = selectedKey(value);
					if (existingKeys.has(key)) {
						continue;
					}
					existingKeys.add(key);
					result.push(value);
				}
				return result;
			}

			function openOptions() {
				isOpen = true;
				renderOptions();
			}

			function closeOptions() {
				isOpen = false;
				renderOptions();
			}

			input.addEventListener('focus', openOptions);
			input.addEventListener('blur', () => {
				window.setTimeout(closeOptions, 0);
			});
			input.addEventListener('input', () => {
				isOpen = true;
				renderOptions();
			});
			input.addEventListener('keydown', event => {
				if (event.key !== 'Enter') {
					return;
				}

				event.preventDefault();
				const typedValues = splitInput(input.value);
				if (options.allowCustom && typedValues.length) {
					const exactOption = [...optionsContainer.querySelectorAll('.option-item')]
						.find(option => selectedKey(option.getAttribute('data-value')) === selectedKey(input.value));
					if (exactOption) {
						addValue(exactOption.getAttribute('data-value'));
						return;
					}

					addTypedValues();
					return;
				}

				const firstOption = optionsContainer.querySelector('.option-item');
				if (firstOption) {
					addValue(firstOption.getAttribute('data-value'));
				}
			});

			optionsContainer.addEventListener('mousedown', event => {
				event.preventDefault();
			});

			optionsContainer.addEventListener('click', event => {
				const option = event.target.closest('.option-item');
				if (!option) {
					return;
				}

				addValue(option.getAttribute('data-value'));
			});

			selectedContainer.addEventListener('click', event => {
				const button = event.target.closest('button');
				if (!button) {
					return;
				}

				const chip = button.closest('.selected-chip');
				const value = chip ? chip.getAttribute('data-value') : undefined;
				if (!value) {
					return;
				}

				selected = selected.filter(item => item !== value);
				render();
			});

			return {
				setItems(nextItems) {
					items = nextItems;
					render();
				},
				setValues(nextValues) {
					selected = nextValues.map(value => String(value || '').trim()).filter(Boolean);
					render();
				},
				values() {
					return valuesWithPendingInput();
				},
			};
		}

		const labelPicker = createMultiPicker(labelsInput, labelOptions, selectedLabels, { allowCustom: true });
		const assigneePicker = createMultiPicker(assigneesInput, assigneeOptions, selectedAssignees, { allowCustom: true });

		function showError(message) {
			const el = document.getElementById('error');
			if (!message) {
				el.style.display = 'none';
				el.textContent = '';
				return;
			}
			el.textContent = message;
			el.style.display = 'block';
		}

		function populateDefaults(defaults) {
			currentDefaults = defaults;
			document.getElementById('repository-name').textContent = defaults.repository.fullName;
			document.getElementById('title').value = defaults.title || '';
			document.getElementById('body').value = defaults.body || '';
			document.getElementById('templatePath').value = defaults.templatePath || '';
			document.getElementById('securityHole').checked = Boolean(defaults.securityHole);

			const milestone = document.getElementById('milestone');
			milestone.innerHTML = '<option value="">No milestone</option>';
			(defaults.milestones || []).forEach((item) => {
				const option = document.createElement('option');
				option.value = String(item.number);
				option.textContent = item.title;
				option.selected = item.number === defaults.milestoneNumber;
				milestone.appendChild(option);
			});

			const template = document.getElementById('template');
			template.innerHTML = '<option value="">No template</option>';
			(defaults.templates || []).forEach((item) => {
				const option = document.createElement('option');
				option.value = item.path;
				option.textContent = item.label;
				template.appendChild(option);
			});

			labelPicker.setItems((defaults.labels || []).map((item) => ({
				value: item.name,
				label: item.name,
				selectedLabel: item.name,
			})).filter((item) => item.value));
			labelPicker.setValues(defaults.selectedLabels || []);

			assigneePicker.setItems((defaults.members || []).map((item) => ({
				value: item.login,
				label: (item.name || item.login) + '@' + item.login,
				selectedLabel: item.name || item.login,
			})).filter((item) => item.value));
			assigneePicker.setValues(defaults.assignees || []);

			const warnings = document.getElementById('warnings');
			warnings.innerHTML = '';
			(defaults.warnings || []).forEach((warning) => {
				const el = document.createElement('div');
				el.className = 'warning';
				el.textContent = warning;
				warnings.appendChild(el);
			});

			showError('');
			setBusy(false);
		}

		document.getElementById('template').addEventListener('change', (event) => {
			if (!currentDefaults) {
				return;
			}

			const path = event.target.value;
			const templatePathInput = document.getElementById('templatePath');
			const bodyInput = document.getElementById('body');
			if (!path) {
				templatePathInput.value = '';
				return;
			}

			const selected = (currentDefaults.templates || []).find((item) => item.path === path);
			if (!selected) {
				return;
			}

			templatePathInput.value = selected.path;
			if (typeof selected.body !== 'string') {
				return;
			}

			if (!bodyInput.value.trim()) {
				bodyInput.value = selected.body;
				return;
			}

			if (window.confirm('Replace the current description with the selected template?')) {
				bodyInput.value = selected.body;
			}
		});

		document.getElementById('submit-button').addEventListener('click', () => {
			showError('');
			setBusy(true);
			vscode.postMessage({
				command: 'submit',
				input: {
					title: document.getElementById('title').value,
					body: document.getElementById('body').value,
					labels: labelPicker.values(),
					assignees: assigneePicker.values(),
					milestoneNumber: document.getElementById('milestone').value ? Number(document.getElementById('milestone').value) : undefined,
					securityHole: document.getElementById('securityHole').checked,
					templatePath: document.getElementById('templatePath').value,
				},
			});
		});

		document.getElementById('cancel-button').addEventListener('click', () => {
			vscode.postMessage({ command: 'cancel' });
		});

		window.addEventListener('message', (event) => {
			const message = event.data;
			switch (message.command) {
				case 'loading':
					setBusy(true);
					break;
				case 'initialize':
					populateDefaults(message.defaults);
					break;
				case 'validationError':
				case 'error':
					setBusy(false);
					showError(message.message);
					break;
				case 'submitDone':
					setBusy(false);
					break;
			}
		});

		vscode.postMessage({ command: 'ready' });
	</script>
</body>
</html>`;
}
