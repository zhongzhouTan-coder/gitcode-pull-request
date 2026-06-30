(function () {
	const vscode = acquireVsCodeApi();
	const stickyHeader = document.getElementById('stickyHeader');
	const mainHeader = document.querySelector('.header');
	const threshold = mainHeader ? mainHeader.getBoundingClientRect().height : 120;

	document.addEventListener('scroll', () => {
		if (!stickyHeader) {
			return;
		}

		if (window.scrollY > threshold) {
			stickyHeader.classList.add('visible');
		} else {
			stickyHeader.classList.remove('visible');
		}
	}, { passive: true });

	for (const element of document.querySelectorAll('[data-action]')) {
		element.addEventListener('click', (event) => {
			const target = event.currentTarget;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			// Skip checkbox inputs — they are handled by the change listener below
			if (target instanceof HTMLInputElement && target.type === 'checkbox') {
				return;
			}

			vscode.postMessage({
				command: target.dataset.action,
				url: target.dataset.url,
				text: target.dataset.text,
			});
		});
	}

	// Handle toggle checkboxes for comment status changes
	for (const toggle of document.querySelectorAll('.comment-toggle-input')) {
		toggle.addEventListener('change', (event) => {
			const input = event.currentTarget;
			if (!(input instanceof HTMLInputElement)) {
				return;
			}

			const discussionId = input.dataset.discussionId;
			if (!discussionId) {
				return;
			}

			const resolved = input.checked;
			input.disabled = true;

			vscode.postMessage({
				command: 'revisePullRequestCommentStatus',
				discussionId,
				resolved,
			});
		});
	}

	// Listen for error messages from the extension host
	window.addEventListener('message', (event) => {
		const message = event.data;
		if (message?.command === 'reviseCommentStatusError' && message.discussionId) {
			const toggle = document.querySelector(`.comment-toggle-input[data-discussion-id="${CSS.escape(message.discussionId)}"]`);
			if (toggle instanceof HTMLInputElement) {
				// Revert the toggle to its previous state
				toggle.checked = !toggle.checked;
				toggle.disabled = false;

				// Show error near the toggle
				const statusContainer = toggle.closest('.comment-review-status');
				if (statusContainer) {
					let errorEl = statusContainer.querySelector('.comment-toggle-error');
					if (!errorEl) {
						errorEl = document.createElement('span');
						errorEl.className = 'comment-toggle-error';
						statusContainer.appendChild(errorEl);
					}
					errorEl.textContent = message.error ?? 'Failed to revise comment status.';
				}
			}
		}
	});
})();
