document.write('<div id="menu-wrapper">');
document.write('	<div id="menu">');
document.write('		<ul>');
document.write('			<li id="index"><a href="index.html">main</a></li>');
document.write('			<li id="sourcecode"><a href="sourcecode.html">sourcecode</a></li>');
document.write('			<li id="contact"><a href="contact.html">Contact</a></li>');
document.write('		</ul>');
document.write('	</div>');
document.write('	<!-- end #menu -->');
document.write('</div>');


// Get the pagename
var sPath = window.location.pathname;
var sPage = sPath.substring(sPath.lastIndexOf('/') + 1);
sPage = sPage.substring(0, sPage.indexOf('.'));

document.getElementById(sPage).className = "current_page_item";
