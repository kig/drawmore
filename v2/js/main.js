"use strict";

// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('./ServiceWorker.js').then(function(registration) {
//     // Registration was successful
//     console.log('ServiceWorker registration successful with scope: ',    registration.scope);
//   }).catch(function(err) {
//     // registration failed :(
//     console.log('ServiceWorker registration failed: ', err);
//   });
// }


var App = function() {

	this.container = document.body;

	var self = this;
	this.initIndexedDB(function() {
		self.initFilePicker();
		self.buildFilePicker(self.container);
	});
};

for (var i in AppDBMixin) {
	App.prototype[i] = AppDBMixin[i];
}

var app = new App();
