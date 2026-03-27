(function () {
	var menuHtml = '' +
		'<div id="menu-wrapper">' +
		'	<div id="menu">' +
		'		<ul>' +
		'			<li id="index"><a href="index.html">main</a></li>' +
		'			<li id="sourcecode"><a href="sourcecode.html">sourcecode</a></li>' +
		'			<li id="contact"><a href="contact.html">Contact</a></li>' +
		'		</ul>' +
		'	</div>' +
		'	<!-- end #menu -->' +
		'</div>';

	var mount = document.getElementById('menu-root');
	if (mount) {
		mount.innerHTML = menuHtml;
	} else {
		document.write(menuHtml);
	}

	// Get the page name from the current pathname and highlight menu entry.
	var sPath = window.location.pathname;
	var sPage = sPath.substring(sPath.lastIndexOf('/') + 1);
	var dotIndex = sPage.indexOf('.');
	if (dotIndex !== -1) {
		sPage = sPage.substring(0, dotIndex);
	}

	var currentItem = document.getElementById(sPage);
	if (currentItem) {
		currentItem.className = 'current_page_item';
	}
})();
