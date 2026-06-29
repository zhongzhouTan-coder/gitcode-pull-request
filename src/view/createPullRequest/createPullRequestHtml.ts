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
			--bg-input: var(--vscode-input-background, #3c3c3c);
			--fg-primary: var(--vscode-editor-foreground, #cccccc);
			--fg-secondary: var(--vscode-descriptionForeground, #999999);
			--border-color: var(--vscode-input-border, #555555);
			--focus-border: var(--vscode-focusBorder, #007acc);
			--button-bg: var(--vscode-button-background, #007acc);
			--button-fg: var(--vscode-button-foreground, #ffffff);
			--button-hover: var(--vscode-button-hoverBackground, #1a8ad4);
			--error-color: var(--vscode-errorForeground, #f48771);
			--warning-color: #cca700;
			--checkbox-bg: var(--vscode-checkbox-background, #3c3c3c);
			--checkbox-border: var(--vscode-checkbox-border, #555555);
		}

		* { box-sizing: border-box; margin: 0; padding: 0; }

		body {
			font-family: var(--vscode-font-family, -apple-system, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			color: var(--fg-primary);
			background: var(--bg-primary);
			padding: 16px;
			line-height: 1.5;
		}

		h2 {
			font-size: 18px;
			font-weight: 600;
			margin-bottom: 16px;
		}

		.form-group {
			margin-bottom: 14px;
		}

		label {
			display: block;
			font-size: 12px;
			font-weight: 600;
			color: var(--fg-secondary);
			margin-bottom: 4px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		input[type="text"],
		textarea,
		select {
			width: 100%;
			padding: 6px 10px;
			font-size: 13px;
			font-family: var(--vscode-font-family, -apple-system, sans-serif);
			color: var(--fg-primary);
			background: var(--bg-input);
			border: 1px solid var(--border-color);
			border-radius: 2px;
			outline: none;
		}

		input[type="text"]:focus,
		textarea:focus,
		select:focus {
			border-color: var(--focus-border);
		}

		textarea {
			min-height: 100px;
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
			min-height: 28px;
			padding: 4px;
			border: 1px solid var(--border-color);
			border-radius: 2px;
			background: var(--bg-secondary);
		}

		.selected-chip {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			max-width: 100%;
			padding: 2px 6px;
			border: 1px solid var(--border-color);
			border-radius: 2px;
			background: var(--bg-input);
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
			border-radius: 2px;
			background: var(--bg-secondary);
		}

		.option-list.hidden {
			display: none;
		}

		.option-item {
			width: 100%;
			padding: 5px 8px;
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
			padding: 6px 8px;
			color: var(--fg-secondary);
		}

		.row {
			display: flex;
			gap: 12px;
		}

		.row > .form-group {
			flex: 1;
		}

		.checkbox-group {
			display: flex;
			flex-wrap: wrap;
			gap: 16px;
			margin-bottom: 14px;
		}

		.checkbox-item {
			display: flex;
			align-items: center;
			gap: 6px;
			cursor: pointer;
		}

		.checkbox-item input[type="checkbox"] {
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
		}

		.button-row {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			margin-top: 20px;
		}

		button {
			padding: 6px 16px;
			font-size: 13px;
			border: none;
			border-radius: 2px;
			cursor: pointer;
		}

		.btn-primary {
			background: var(--button-bg);
			color: var(--button-fg);
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
			margin-top: 4px;
		}

		.warning-message {
			color: var(--warning-color);
			font-size: 12px;
			margin-top: 4px;
			padding: 8px;
			background: rgba(204, 167, 0, 0.1);
			border-left: 3px solid var(--warning-color);
			border-radius: 2px;
		}

		.loading {
			text-align: center;
			padding: 40px;
			color: var(--fg-secondary);
		}

		.idle-state {
			text-align: center;
			padding: 40px 16px;
			color: var(--fg-secondary);
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
	</style>
</head>
<body>
	<div id="idle-state" class="idle-state">No pull request in progress.</div>
	<div id="loading-state" class="loading hidden">Loading...</div>
	<div id="error-state" class="hidden"></div>

	<form id="create-form" class="hidden">
		<h2>Create Pull Request</h2>

		<div id="error-area"></div>
		<div id="warning-area"></div>

		<div class="row">
			<div class="form-group">
				<label for="source-repository">Source Repository</label>
				<select id="source-repository">
					<option value="">Select source repository...</option>
				</select>
			</div>
			<div class="form-group">
				<label for="target-repository">Target Repository</label>
				<select id="target-repository">
					<option value="">Select target repository...</option>
				</select>
			</div>
		</div>

		<div class="row">
			<div class="form-group">
				<label for="source-branch">Source Branch</label>
				<select id="source-branch">
					<option value="">Select source branch...</option>
				</select>
			</div>
			<div class="form-group">
				<label for="target-branch">Target Branch</label>
				<select id="target-branch">
					<option value="">Select target branch...</option>
				</select>
			</div>
		</div>

		<div class="form-group">
			<label for="title">Title</label>
			<input type="text" id="title" placeholder="Pull request title..." required>
		</div>

		<div class="form-group">
			<label for="body">Description</label>
			<textarea id="body" placeholder="Pull request description..."></textarea>
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

		<div id="squash-message-group" class="form-group hidden">
			<label for="squash-message">Squash Commit Message</label>
			<input type="text" id="squash-message" placeholder="Squash commit message...">
		</div>

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
