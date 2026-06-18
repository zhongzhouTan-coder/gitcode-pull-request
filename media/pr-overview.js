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

			vscode.postMessage({
				command: target.dataset.action,
				url: target.dataset.url,
				text: target.dataset.text,
			});
		});
	}
})();
