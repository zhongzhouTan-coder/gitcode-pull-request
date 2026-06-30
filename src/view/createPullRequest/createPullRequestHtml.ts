export function getCreatePullRequestHtml(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Create Pull Request</title>
	<style>
		:root {
			--bg-primary: var(--vscode-editor-background, #1e1e1e);
			--bg-secondary: var(--vscode-sideBar-background, #252526);
			--surface: var(--bg-secondary);
			--surface-soft: transparent;
			--bg-input: var(--vscode-input-background, #3c3c3c);
			--fg-primary: var(--vscode-editor-foreground, #cccccc);
			--fg-secondary: var(--vscode-descriptionForeground, #999999);
			--border-color: var(--vscode-panel-border, var(--vscode-input-border, #555555));
			--focus-border: var(--vscode-focusBorder, #007acc);
			--accent: var(--vscode-textLink-foreground, #58a6ff);
			--button-bg: var(--vscode-button-background, #007acc);
			--button-fg: var(--vscode-button-foreground, #ffffff);
			--button-hover: var(--vscode-button-hoverBackground, #1a8ad4);
			--error-color: var(--vscode-errorForeground, #f48771);
			--warning-color: var(--vscode-editorWarning-foreground, #cca700);
			--checkbox-bg: var(--vscode-checkbox-background, #3c3c3c);
			--checkbox-border: var(--vscode-checkbox-border, #555555);
		}

		* { box-sizing: border-box; margin: 0; padding: 0; }

		body {
			font-family: var(--vscode-font-family, -apple-system, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			color: var(--fg-primary);
			background: var(--bg-primary);
			padding: 14px;
			line-height: 1.5;
		}

		h2 {
			font-size: 20px;
			font-weight: 700;
			line-height: 1.2;
		}

		.pr-shell {
			display: flex;
			flex-direction: column;
			gap: 12px;
			max-width: 760px;
			margin: 0 auto;
		}

		.pr-hero {
			position: relative;
			overflow: hidden;
			padding: 16px;
			border: 1px solid var(--border-color);
			border-radius: 14px;
			background: transparent;
		}

		.pr-hero::after {
			content: "";
			position: absolute;
			right: -28px;
			top: -34px;
			width: 86px;
			height: 86px;
			border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
			border-radius: 999px;
		}

		.pr-eyebrow {
			margin-bottom: 5px;
			color: var(--accent);
			font-size: 11px;
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.pr-subtitle {
			margin-top: 6px;
			color: var(--fg-secondary);
			max-width: 56ch;
		}

		.form-section {
			padding: 14px;
			border: 1px solid var(--border-color);
			border-radius: 12px;
			background: transparent;
		}

		.section-heading {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 10px;
			margin-bottom: 12px;
		}

		.section-heading h3 {
			font-size: 13px;
			font-weight: 750;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}

		.section-kicker {
			color: var(--fg-secondary);
			font-size: 12px;
		}

		.form-group {
			min-width: 0;
			margin-bottom: 12px;
		}

		label {
			display: block;
			font-size: 11px;
			font-weight: 750;
			color: var(--fg-secondary);
			margin-bottom: 5px;
			text-transform: uppercase;
			letter-spacing: 0.06em;
		}

		input[type="text"],
		textarea,
		select {
			width: 100%;
			padding: 8px 10px;
			font-size: 13px;
			font-family: var(--vscode-font-family, -apple-system, sans-serif);
			color: var(--fg-primary);
			background: var(--bg-input);
			border: 1px solid var(--border-color);
			border-radius: 8px;
			outline: none;
			transition: border-color 0.12s ease, box-shadow 0.12s ease;
		}

		input[type="text"]:focus,
		textarea:focus,
		select:focus {
			border-color: var(--focus-border);
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-border) 18%, transparent);
		}

		textarea {
			min-height: 136px;
			resize: vertical;
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
			border: 1px solid var(--border-color);
			border-radius: 8px;
			background: transparent;
		}

		.selected-chip {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			max-width: 100%;
			padding: 3px 7px;
			border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border-color));
			border-radius: 999px;
			background: transparent;
			color: var(--fg-primary);
		}

		.selected-chip span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.selected-chip button {
			padding: 0 2px;
			background: transparent;
			color: var(--fg-secondary);
			border: none;
			font-size: 14px;
			line-height: 1;
		}

		.option-list {
			max-height: 140px;
			overflow: auto;
			border: 1px solid var(--border-color);
			border-radius: 8px;
			background: var(--bg-secondary);
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
			color: var(--fg-primary);
			border: none;
			border-radius: 0;
		}

		.option-item:hover,
		.option-item:focus {
			background: var(--vscode-list-hoverBackground, var(--bg-input));
			outline: none;
		}

		.empty-options {
			padding: 8px 9px;
			color: var(--fg-secondary);
		}

		.row {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}

		.row > .form-group {
			margin-bottom: 12px;
		}

		.branch-matrix {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 10px;
		}

		.route-card {
			padding: 12px;
			border: 1px solid var(--border-color);
			border-radius: 11px;
			background: transparent;
		}

		.route-label {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 10px;
			color: var(--fg-secondary);
			font-size: 11px;
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.route-dot {
			width: 7px;
			height: 7px;
			border-radius: 999px;
			background: var(--accent);
		}

		.route-dot.target {
			background: var(--vscode-testing-iconPassed, #2da44e);
		}

		.checkbox-group {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
			margin-bottom: 0;
		}

		.checkbox-item {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			min-width: 0;
			padding: 9px 10px;
			border: 1px solid var(--border-color);
			border-radius: 9px;
			background: transparent;
			cursor: pointer;
		}

		.checkbox-item input[type="checkbox"] {
			margin-top: 2px;
			accent-color: var(--focus-border);
		}

		.checkbox-item label {
			margin-bottom: 0;
			text-transform: none;
			letter-spacing: normal;
			font-weight: normal;
			font-size: 13px;
			color: var(--fg-primary);
			cursor: pointer;
			line-height: 1.35;
		}

		.button-row {
			position: sticky;
			bottom: 0;
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			margin: 0 -14px -14px;
			padding: 12px 14px;
			border-top: 1px solid var(--border-color);
			background: var(--bg-primary);
			backdrop-filter: blur(12px);
		}

		button {
			padding: 7px 14px;
			font-size: 13px;
			border: none;
			border-radius: 8px;
			cursor: pointer;
		}

		.btn-primary {
			background: var(--button-bg);
			color: var(--button-fg);
			font-weight: 650;
		}

		.btn-primary:hover {
			background: var(--button-hover);
		}

		.btn-primary:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.btn-secondary {
			background: var(--vscode-button-secondaryBackground, var(--bg-input));
			color: var(--vscode-button-secondaryForeground, var(--fg-primary));
			border: 1px solid var(--border-color);
		}

		.btn-secondary:hover {
			background: var(--vscode-button-secondaryHoverBackground, var(--bg-secondary));
		}

		.error-message {
			color: var(--error-color);
			font-size: 12px;
			margin-bottom: 8px;
			padding: 8px 10px;
			border: 1px solid color-mix(in srgb, var(--error-color) 28%, var(--border-color));
			border-radius: 8px;
			background: color-mix(in srgb, var(--error-color) 7%, transparent);
		}

		.warning-message {
			color: var(--warning-color);
			font-size: 12px;
			margin-bottom: 10px;
			padding: 9px 10px;
			background: color-mix(in srgb, var(--warning-color) 9%, transparent);
			border: 1px solid color-mix(in srgb, var(--warning-color) 26%, var(--border-color));
			border-radius: 8px;
		}

		.loading {
			text-align: center;
			padding: 48px 18px;
			color: var(--fg-secondary);
		}

		.idle-state {
			text-align: center;
			padding: 44px 16px;
			color: var(--fg-secondary);
			border: 1px dashed var(--border-color);
			border-radius: 14px;
			background: transparent;
		}

		.hidden {
			display: none !important;
		}

		#error-area {
			margin-bottom: 12px;
		}

		#loading-state, #error-state, #idle-state {
			text-align: center;
			padding: 40px;
		}

		#error-state {
			color: var(--error-color);
		}

		@media (max-width: 560px) {
			body {
				padding: 10px;
			}

			.row,
			.checkbox-group,
			.sidebar-field-grid {
				grid-template-columns: 1fr;
			}

			.pr-hero,
			.form-section {
				border-radius: 11px;
				padding: 12px;
			}
		}
	</style>
</head>
<body>
	<div id="idle-state" class="idle-state">No pull request in progress.</div>
	<div id="loading-state" class="loading hidden">Loading...</div>
	<div id="error-state" class="hidden"></div>

	<form id="create-form" class="pr-shell hidden">
		<div class="pr-hero">
			<div class="pr-eyebrow">GitCode workflow</div>
			<h2>Create Pull Request</h2>
			<p class="pr-subtitle">Choose the branch route, describe the change, then assign ownership before opening the pull request.</p>
		</div>

		<div id="error-area"></div>
		<div id="warning-area"></div>

		<section class="form-section">
			<div class="section-heading">
				<h3>Branch Route</h3>
				<span class="section-kicker">from source into target</span>
			</div>
			<div class="branch-matrix">
				<div class="route-card">
					<div class="route-label"><span class="route-dot"></span>Source</div>
					<div class="row">
						<div class="form-group">
							<label for="source-repository">Repository</label>
							<select id="source-repository">
								<option value="">Select source repository...</option>
							</select>
						</div>
						<div class="form-group">
							<label for="source-branch">Branch</label>
							<select id="source-branch">
								<option value="">Select source branch...</option>
							</select>
						</div>
					</div>
				</div>
				<div class="route-card">
					<div class="route-label"><span class="route-dot target"></span>Target</div>
					<div class="row">
						<div class="form-group">
							<label for="target-repository">Repository</label>
							<select id="target-repository">
								<option value="">Select target repository...</option>
							</select>
						</div>
						<div class="form-group">
							<label for="target-branch">Branch</label>
							<select id="target-branch">
								<option value="">Select target branch...</option>
							</select>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="form-section">
			<div class="section-heading">
				<h3>Content</h3>
				<span class="section-kicker">what reviewers will read first</span>
			</div>
			<div class="form-group">
				<label for="title">Title</label>
				<input type="text" id="title" placeholder="Summarize the change..." required>
			</div>
			<div class="form-group">
				<label for="body">Description</label>
				<textarea id="body" placeholder="Add context, testing notes, and reviewer guidance..."></textarea>
			</div>
		</section>

		<section class="form-section">
			<div class="section-heading">
				<h3>Review Metadata</h3>
				<span class="section-kicker">labels, owners, and release target</span>
			</div>
			<div class="row">
				<div class="form-group">
					<label for="labels">Labels</label>
					<div class="multi-picker">
						<input type="text" id="labels" autocomplete="off" placeholder="Search labels...">
						<div id="label-options" class="option-list"></div>
						<div id="selected-labels" class="selected-items"></div>
					</div>
				</div>
				<div class="form-group">
					<label for="milestone">Milestone</label>
					<select id="milestone">
						<option value="">No milestone</option>
					</select>
				</div>
			</div>
			<div class="row">
				<div class="form-group">
					<label for="assignees">Assignees</label>
					<div class="multi-picker">
						<input type="text" id="assignees" autocomplete="off" placeholder="Search members...">
						<div id="assignee-options" class="option-list"></div>
						<div id="selected-assignees" class="selected-items"></div>
					</div>
				</div>
				<div class="form-group">
					<label for="testers">Testers</label>
					<div class="multi-picker">
						<input type="text" id="testers" autocomplete="off" placeholder="Search members...">
						<div id="tester-options" class="option-list"></div>
						<div id="selected-testers" class="selected-items"></div>
					</div>
				</div>
			</div>
		</section>

		<section class="form-section">
			<div class="section-heading">
				<h3>Merge Options</h3>
				<span class="section-kicker">how this PR should land</span>
			</div>
			<div class="checkbox-group">
				<div class="checkbox-item">
					<input type="checkbox" id="draft">
					<label for="draft">Draft</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="prune">
					<label for="prune">Delete source branch after merge</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="squash">
					<label for="squash">Squash commits</label>
				</div>
				<div class="checkbox-item">
					<input type="checkbox" id="close-issue">
					<label for="close-issue">Close related issue after merge</label>
				</div>
			</div>

			<div id="squash-message-group" class="form-group hidden">
				<label for="squash-message">Squash Commit Message</label>
				<input type="text" id="squash-message" placeholder="Squash commit message...">
			</div>
		</section>

		<div class="button-row">
			<button type="button" id="cancel-btn" class="btn-secondary">Cancel</button>
			<button type="submit" id="submit-btn" class="btn-primary">Create Pull Request</button>
		</div>
	</form>

	<script>
		const vscode = acquireVsCodeApi();
		let isRestoringState = false;

		// Elements
		const idleState = document.getElementById('idle-state');
		const loadingState = document.getElementById('loading-state');
		const errorState = document.getElementById('error-state');
		const form = document.getElementById('create-form');
		const errorArea = document.getElementById('error-area');
		const warningArea = document.getElementById('warning-area');
		const sourceRepoSelect = document.getElementById('source-repository');
		const targetRepoSelect = document.getElementById('target-repository');
		const sourceSelect = document.getElementById('source-branch');
		const targetSelect = document.getElementById('target-branch');
		const titleInput = document.getElementById('title');
		const bodyInput = document.getElementById('body');
		const draftCheckbox = document.getElementById('draft');
		const pruneCheckbox = document.getElementById('prune');
		const squashCheckbox = document.getElementById('squash');
		const closeIssueCheckbox = document.getElementById('close-issue');
		const labelsInput = document.getElementById('labels');
		const labelOptions = document.getElementById('label-options');
		const selectedLabels = document.getElementById('selected-labels');
		const milestoneSelect = document.getElementById('milestone');
		const assigneesInput = document.getElementById('assignees');
		const assigneeOptions = document.getElementById('assignee-options');
		const selectedAssignees = document.getElementById('selected-assignees');
		const testersInput = document.getElementById('testers');
		const testerOptions = document.getElementById('tester-options');
		const selectedTesters = document.getElementById('selected-testers');
		const squashMessageGroup = document.getElementById('squash-message-group');
		const squashMessageInput = document.getElementById('squash-message');
		const cancelBtn = document.getElementById('cancel-btn');
		const submitBtn = document.getElementById('submit-btn');
		const labelPicker = createMultiPicker(labelsInput, labelOptions, selectedLabels, persistFormState);
		const assigneePicker = createMultiPicker(assigneesInput, assigneeOptions, selectedAssignees, persistFormState);
		const testerPicker = createMultiPicker(testersInput, testerOptions, selectedTesters, persistFormState);

		// Toggle squash message visibility
		squashCheckbox.addEventListener('change', () => {
			squashMessageGroup.classList.toggle('hidden', !squashCheckbox.checked);
			persistFormState();
		});

		function escapeHtml(value) {
			return String(value ?? '')
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		function optionHtml(value, label, selected) {
			const escapedValue = escapeHtml(value);
			return '<option value="' + escapedValue + '"' + (selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
		}

		function createMultiPicker(input, optionsContainer, selectedContainer, onChange) {
			let items = [];
			let selected = [];
			let isOpen = false;

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
				if (!value || selected.includes(value)) {
					return;
				}

				selected = [...selected, value];
				input.value = '';
				render();
				input.focus();
				onChange();
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
				onChange();
			});

			return {
				setItems(nextItems) {
					items = nextItems;
					const values = new Set(items.map(item => item.value));
					selected = selected.filter(value => values.has(value));
					render();
				},
				setValues(nextValues) {
					const values = new Set(items.map(item => item.value));
					selected = nextValues.filter(value => values.has(value));
					render();
				},
				clear() {
					items = [];
					selected = [];
					isOpen = false;
					input.value = '';
					render();
				},
				values() {
					return selected;
				},
			};
		}

		function renderRepositories(repositories, sourceRepository, targetRepository) {
			const options = Array.isArray(repositories) ? repositories : [];
			sourceRepoSelect.innerHTML = options.map(repo =>
				optionHtml(repo.fullName, repo.fullName + ' (' + repo.remoteName + ')', sourceRepository && repo.fullName === sourceRepository.fullName)
			).join('');
			targetRepoSelect.innerHTML = options.map(repo =>
				optionHtml(repo.fullName, repo.fullName + ' (' + repo.remoteName + ')', targetRepository && repo.fullName === targetRepository.fullName)
			).join('');
		}

		function renderBranches(sourceBranches, targetBranches, sourceBranch, targetBranch) {
			sourceSelect.innerHTML = (Array.isArray(sourceBranches) ? sourceBranches : []).map(b =>
				optionHtml(b.name, b.name + (b.isDefault ? ' (default)' : ''), b.name === sourceBranch)
			).join('');
			targetSelect.innerHTML = (Array.isArray(targetBranches) ? targetBranches : []).map(b =>
				optionHtml(b.name, b.name + (b.isDefault ? ' (default)' : ''), b.name === targetBranch)
			).join('');
		}

		function renderMilestones(milestones) {
			milestoneSelect.innerHTML = '<option value="">No milestone</option>' +
				(Array.isArray(milestones) ? milestones : []).map(m => optionHtml(m.number, m.title, false)).join('');
		}

		function renderLabels(labels) {
			labelPicker.setItems((Array.isArray(labels) ? labels : []).map(label => {
				const name = label.name || '';
				return { value: name, label: name, selectedLabel: name };
			}).filter(item => item.value));
		}

		function renderMembers(members) {
			const options = (Array.isArray(members) ? members : []).map(member => {
				const username = member.login || '';
				const nickName = member.name || username;
				return {
					value: username,
					label: nickName + '@' + username,
					selectedLabel: nickName,
				};
			}).filter(item => item.value);
			assigneePicker.setItems(options);
			testerPicker.setItems(options);
		}

		function applyRepositoryFields(data) {
			renderBranches(data.sourceBranches, data.targetBranches, data.sourceBranch, data.targetBranch);
			renderLabels(data.labels);
			renderMilestones(data.milestones);
			renderMembers(data.members);
			if (data.title !== undefined) titleInput.value = data.title;
			if (data.body !== undefined) bodyInput.value = data.body;
			if (data.warning) showWarning(data.warning);
			else warningArea.innerHTML = '';
		}

		function showForm(defaults) {
			isRestoringState = true;
			idleState.classList.add('hidden');
			loadingState.classList.add('hidden');
			errorState.classList.add('hidden');
			form.classList.remove('hidden');

			renderRepositories(defaults.repositories, defaults.sourceRepository, defaults.targetRepository);
			applyRepositoryFields(defaults);

			titleInput.value = defaults.title || '';
			bodyInput.value = defaults.body || '';

			if (defaults.duplicateWarning) {
				showWarning(defaults.duplicateWarning);
			}

			restoreFormState();
			isRestoringState = false;
			persistFormState();
		}

		function showWarning(msg) {
			warningArea.innerHTML = '<div class="warning-message">' + escapeHtml(msg) + '</div>';
		}

		function showErrors(errors) {
			errorArea.innerHTML = errors.map(e => '<div class="error-message">' + escapeHtml(e) + '</div>').join('');
		}

		function showError(msg) {
			idleState.classList.add('hidden');
			loadingState.classList.add('hidden');
			form.classList.add('hidden');
			errorState.classList.remove('hidden');
			errorState.textContent = msg;
		}

		function showLoading() {
			vscode.setState({});
			idleState.classList.add('hidden');
			errorState.classList.add('hidden');
			form.classList.add('hidden');
			loadingState.classList.remove('hidden');
		}

		function resetForm() {
			isRestoringState = true;
			form.reset();
			errorArea.innerHTML = '';
			warningArea.innerHTML = '';
			labelPicker.clear();
			assigneePicker.clear();
			testerPicker.clear();
			submitBtn.disabled = false;
			submitBtn.textContent = 'Create Pull Request';
			squashMessageGroup.classList.add('hidden');
			loadingState.classList.add('hidden');
			errorState.classList.add('hidden');
			form.classList.add('hidden');
			idleState.classList.remove('hidden');
			vscode.setState({});
			isRestoringState = false;
		}

		function restoreFormState() {
			const state = vscode.getState();
			const saved = state && state.form;
			if (!saved) {
				return;
			}

			if (saved.sourceRepository) sourceRepoSelect.value = saved.sourceRepository;
			if (saved.targetRepository) targetRepoSelect.value = saved.targetRepository;
			if (saved.sourceBranch) sourceSelect.value = saved.sourceBranch;
			if (saved.targetBranch) targetSelect.value = saved.targetBranch;
			if (saved.title !== undefined) titleInput.value = saved.title;
			if (saved.body !== undefined) bodyInput.value = saved.body;
			if (saved.milestone !== undefined) milestoneSelect.value = saved.milestone;
			labelPicker.setValues(Array.isArray(saved.labels) ? saved.labels : []);
			assigneePicker.setValues(Array.isArray(saved.assignees) ? saved.assignees : []);
			testerPicker.setValues(Array.isArray(saved.testers) ? saved.testers : []);
			draftCheckbox.checked = Boolean(saved.draft);
			pruneCheckbox.checked = Boolean(saved.prune);
			squashCheckbox.checked = Boolean(saved.squash);
			closeIssueCheckbox.checked = Boolean(saved.closeIssue);
			squashMessageGroup.classList.toggle('hidden', !squashCheckbox.checked);
			if (saved.squashMessage !== undefined) squashMessageInput.value = saved.squashMessage;
		}

		function persistFormState() {
			if (isRestoringState) {
				return;
			}

			vscode.setState({
				form: {
					sourceRepository: sourceRepoSelect.value,
					targetRepository: targetRepoSelect.value,
					sourceBranch: sourceSelect.value,
					targetBranch: targetSelect.value,
					title: titleInput.value,
					body: bodyInput.value,
					labels: labelPicker.values(),
					milestone: milestoneSelect.value,
					assignees: assigneePicker.values(),
					testers: testerPicker.values(),
					draft: draftCheckbox.checked,
					prune: pruneCheckbox.checked,
					squash: squashCheckbox.checked,
					squashMessage: squashMessageInput.value,
					closeIssue: closeIssueCheckbox.checked,
				},
			});
		}

		function collectInput() {
			const milestoneValue = milestoneSelect.value;
			const sourceRepository = sourceRepoSelect.value;
			const targetRepository = targetRepoSelect.value;
			const labels = labelPicker.values().join(',');
			const assignees = assigneePicker.values().join(',');
			const testers = testerPicker.values().join(',');
			return {
				title: titleInput.value.trim(),
				head: sourceSelect.value,
				base: targetSelect.value,
				body: bodyInput.value.trim() || undefined,
				milestoneNumber: milestoneValue ? parseInt(milestoneValue) : undefined,
				labels: labels || undefined,
				issue: undefined,
				assignees: assignees || undefined,
				testers: testers || undefined,
				pruneSourceBranch: pruneCheckbox.checked,
				draft: draftCheckbox.checked,
				squash: squashCheckbox.checked,
				squashCommitMessage: squashCheckbox.checked ? (squashMessageInput.value.trim() || undefined) : undefined,
				forkPath: sourceRepository && targetRepository && sourceRepository !== targetRepository ? sourceRepository : undefined,
				closeRelatedIssue: closeIssueCheckbox.checked,
			};
		}

		// Listen for messages from the extension
		window.addEventListener('message', (event) => {
			const msg = event.data;
			switch (msg.command) {
				case 'loading':
					showLoading();
					break;
				case 'initialize':
					showForm(msg.defaults);
					break;
				case 'error':
					showError(msg.message);
					break;
				case 'updateFields':
					if (msg.title !== undefined) titleInput.value = msg.title;
					if (msg.body !== undefined) bodyInput.value = msg.body;
					if (msg.warning) showWarning(msg.warning);
					else warningArea.innerHTML = '';
					break;
				case 'updateRepositoryFields':
					if (msg.sourceRepository) sourceRepoSelect.value = msg.sourceRepository.fullName;
					if (msg.targetRepository) targetRepoSelect.value = msg.targetRepository.fullName;
					applyRepositoryFields(msg);
					break;
				case 'validationErrors':
					showErrors(msg.errors);
					submitBtn.disabled = false;
					break;
				case 'submitting':
					submitBtn.disabled = true;
					submitBtn.textContent = 'Creating...';
					break;
				case 'submitDone':
					submitBtn.disabled = false;
					submitBtn.textContent = 'Create Pull Request';
					break;
				case 'reset':
					resetForm();
					break;
			}
		});

		// Form field change events — notify extension
		sourceRepoSelect.addEventListener('change', () => {
			vscode.postMessage({ command: 'changeSourceRepository', repositoryFullName: sourceRepoSelect.value });
			persistFormState();
		});

		targetRepoSelect.addEventListener('change', () => {
			vscode.postMessage({ command: 'changeTargetRepository', repositoryFullName: targetRepoSelect.value });
			persistFormState();
		});

		sourceSelect.addEventListener('change', () => {
			vscode.postMessage({ command: 'changeSourceBranch', branch: sourceSelect.value });
			persistFormState();
		});

		targetSelect.addEventListener('change', () => {
			vscode.postMessage({ command: 'changeTargetBranch', branch: targetSelect.value });
			persistFormState();
		});

		titleInput.addEventListener('input', persistFormState);
		bodyInput.addEventListener('input', persistFormState);
		milestoneSelect.addEventListener('change', persistFormState);
		draftCheckbox.addEventListener('change', persistFormState);
		pruneCheckbox.addEventListener('change', persistFormState);
		closeIssueCheckbox.addEventListener('change', persistFormState);
		squashMessageInput.addEventListener('input', persistFormState);

		cancelBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'cancel' });
		});

		// Form submit
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			errorArea.innerHTML = '';
			const input = collectInput();
			submitBtn.disabled = true;
			submitBtn.textContent = 'Creating...';
			vscode.postMessage({ command: 'submit', input: input });
		});

		// Notify extension we are ready
		vscode.postMessage({ command: 'ready' });
	</script>
</body>
</html>`;
}
