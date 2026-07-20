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

		if (message?.command === 'deletePullRequestCommentError' && message.commentId) {
			const commentId = message.commentId;
			// Hide saving spinner
			const savingEl = document.querySelector(`[data-delete-saving="${CSS.escape(commentId)}"]`);
			if (savingEl) {
				savingEl.style.display = 'none';
			}

			// Show confirm/cancel buttons again
			const confirmBtn = document.querySelector(`.btn-confirm-delete[data-comment-id="${CSS.escape(commentId)}"]`);
			const cancelBtn = document.querySelector(`.btn-cancel-delete[data-comment-id="${CSS.escape(commentId)}"]`);
			if (confirmBtn) confirmBtn.disabled = false;
			if (cancelBtn) cancelBtn.disabled = false;

			// Re-enable the trash icon
			const trashBtn = document.querySelector(`.delete-comment-btn[data-comment-id="${CSS.escape(commentId)}"]`);
			if (trashBtn) trashBtn.disabled = false;

			// Show error message
			const errorEl = document.querySelector(`[data-delete-error="${CSS.escape(commentId)}"]`);
			if (errorEl) {
				errorEl.textContent = message.message ?? 'Failed to delete comment.';
				errorEl.style.display = 'block';
			}
		}
	});

	// Handle delete comment action — show confirmation
	for (const btn of document.querySelectorAll('.delete-comment-btn')) {
		btn.addEventListener('click', (event) => {
			const target = event.currentTarget;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const commentId = target.dataset.commentId;
			if (!commentId) {
				return;
			}

			// Hide the delete button
			target.style.display = 'none';

			// Show the confirmation UI
			const confirmEl = document.querySelector(`[data-delete-confirm="${CSS.escape(commentId)}"]`);
			if (confirmEl instanceof HTMLElement) {
				confirmEl.style.display = 'flex';

				// Hide any previous error
				const errorEl = document.querySelector(`[data-delete-error="${CSS.escape(commentId)}"]`);
				if (errorEl instanceof HTMLElement) {
					errorEl.style.display = 'none';
				}
			}
		});
	}

	// Handle cancel delete
	for (const btn of document.querySelectorAll('.btn-cancel-delete')) {
		btn.addEventListener('click', (event) => {
			const target = event.currentTarget;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const commentId = target.dataset.commentId;
			if (!commentId) {
				return;
			}

			// Hide confirmation UI
			const confirmEl = document.querySelector(`[data-delete-confirm="${CSS.escape(commentId)}"]`);
			if (confirmEl instanceof HTMLElement) {
				confirmEl.style.display = 'none';
			}

			// Show the trash button again
			const trashBtn = document.querySelector(`.delete-comment-btn[data-comment-id="${CSS.escape(commentId)}"]`);
			if (trashBtn instanceof HTMLElement) {
				trashBtn.style.display = '';
			}

			// Hide any error
			const errorEl = document.querySelector(`[data-delete-error="${CSS.escape(commentId)}"]`);
			if (errorEl instanceof HTMLElement) {
				errorEl.style.display = 'none';
			}
		});
	}

	// Handle confirm delete
	for (const btn of document.querySelectorAll('.btn-confirm-delete')) {
		btn.addEventListener('click', (event) => {
			const target = event.currentTarget;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const commentId = target.dataset.commentId;
			if (!commentId) {
				return;
			}

			// Disable confirm/cancel buttons
			target.disabled = true;
			const cancelBtn = document.querySelector(`.btn-cancel-delete[data-comment-id="${CSS.escape(commentId)}"]`);
			if (cancelBtn instanceof HTMLButtonElement) {
				cancelBtn.disabled = true;
			}

			// Show saving indicator
			const savingEl = document.querySelector(`[data-delete-saving="${CSS.escape(commentId)}"]`);
			if (savingEl instanceof HTMLElement) {
				savingEl.style.display = 'inline';
			}

			// Hide any error
			const errorEl = document.querySelector(`[data-delete-error="${CSS.escape(commentId)}"]`);
			if (errorEl instanceof HTMLElement) {
				errorEl.style.display = 'none';
			}

			vscode.postMessage({
				command: 'deletePullRequestComment',
				commentId,
			});
		});
	}
})();
