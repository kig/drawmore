"use strict";

var FilePickerMixin = {};

FilePickerMixin.initFilePicker = function() {
	this.thumbnailQueue = [];
};

FilePickerMixin.buildFilePicker = function(container) {
	var self = this;

	var pad = function(v) {
		if (v < 10) v = "0" + v.toString();
		return v;
	};
	var folders = {};

	var createFolder = function(folderName) {
		var folderDiv = folders[folderName];
		if (!folderDiv) {
			folderDiv = folders[folderName] = document.createElement('div');
			folderDiv.className = 'folder';
			folderDiv.classList.add(folderName.replace(/\s/g, '-'));
			var header = document.createElement('h3');
			header.appendChild(document.createTextNode(folderName));
			if (folderName === 'Trash') {
				header.appendChild(document.createTextNode(" — "));
				var emptyTrash = document.createElement('span');
				emptyTrash.className = 'emptyTrash';
				emptyTrash.appendChild(document.createTextNode('Empty Trash'));
				emptyTrash.onclick = function(ev) {
					if (ev && ev.preventDefault) {
						ev.preventDefault();
						ev.stopPropagation();
					}
					if (confirm("Permanently delete all images in the trash can?")) {
						self.emptyTrash(function() {
							self.buildFilePicker(container);
						});
					}
				}
				header.appendChild(emptyTrash);
			}
			folderDiv.appendChild(header);
			container.appendChild(folderDiv);
		}
		return folderDiv;
	};

	this.getSavedImageNames(function(names) {
		container.innerHTML = '';
		var newFolder = document.createElement('button');
		newFolder.innerHTML = 'New Folder';
		newFolder.onclick = function(ev) {
			if (ev && ev.preventDefault) {
				ev.preventDefault();
				ev.stopPropagation();
			}
			var name = prompt('Name for new folder');
			if (name && !folders[name]) {
				var folderDiv = createFolder(name);
				container.insertBefore(folderDiv, container.childNodes[2]);
			}
		}
		//container.appendChild(newFolder);
		//container.appendChild(document.createElement('br'));
		names.sort(function(a,b) {
			if (typeof a.value === 'object' && typeof b.value === 'object') {
				var cmp = a.value.folder.localeCompare(b.value.folder);
				if (cmp !== 0) {
					return cmp;
				}
			}
			if (/^\d+$/.test(a.key) && /^\d+$/.test(b.key)) {
				return b.key - a.key;
			}
			return a.key.localeCompare(b.key);
		});
		names.forEach(function(kv) {
			var name = kv.key;
			var metadata = typeof kv.value === 'object' ? kv.value : {folder: 'Drawings'};
			var folderDiv = createFolder(metadata.folder);

			var nameString = name;
			if (/^\d+$/.test(name) && Math.abs(Date.now() - name) < 30*360*86400*1000 ) { // Timestamp?
				var d = new Date(parseInt(name));
				nameString = ( ""
					+ [d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate())].join("-")
					+ " + " + pad(d.getHours()) + ":" + pad(d.getMinutes())
				);
			}

			var d = document.createElement('div');
			d.className = 'item';
			var nameSpan = document.createElement('span');
			nameSpan.appendChild(document.createTextNode(nameString));
			d.appendChild(nameSpan);

			var trash = document.createElement('div');
			trash.className = 'trash';
			trash.innerHTML = 'Trash';
			d.appendChild(trash);
			trash.onclick = function(ev) {
				if (ev && ev.preventDefault) {
					ev.preventDefault();
					ev.stopPropagation();
				}
				self.moveImageToTrash(name, function() {
					self.buildFilePicker(container);
				});
			};

			var recover = document.createElement('div');
			recover.className = 'recover';
			recover.innerHTML = 'Recover';
			d.appendChild(recover);
			recover.onclick = function(ev) {
				if (ev && ev.preventDefault) {
					ev.preventDefault();
					ev.stopPropagation();
				}
				self.recoverImageFromTrash(name, function() {
					self.buildFilePicker(container);
				});
			};

			d.onclick = function(ev) {
				if (ev && ev.preventDefault) {
					ev.preventDefault();
				}
				// if (d.onclickDisabled) {
				// 	d.onclickDisabled = false;
				// 	ev.stopPropagation();
				// 	return;
				// }
				self.loadImageFromDB(name, function(image) {
					self.drawArray = image.drawArray;
					self.snapshots = image.snapshots;
					self.timeTravel(image.drawEndIndex);
					self.imageName = name;
				}, function(err) {
					console.log("Error loading image:", err);
				});
			};
			// d.onmousedown = d.ontouchstart = function(ev) {
			// 	ev.preventDefault();
			// 	clearTimeout(d.touchTimeout);
			// 	d.touchTimeout = setTimeout(function() {
			// 		d.onclickDisabled = true;
			// 		var folderName = prompt('Move image to folder');
			// 		if (folderName && folderName !== metadata.folder) {
			// 			self.moveImageToFolder(name, folderName, function() {
			// 				self.buildFilePicker(container);
			// 			});
			// 		}
			// 	}, 1000);
			// 	d.down = true;
			// 	d.startPoint = {x: ev.clientX || ev.touches[0].clientX, y: ev.clientY || ev.touches[0].clientY};
			// };
			// d.onmousemove = d.ontouchmove = function(ev) {
			// 	if (d.down) {
			// 		ev.preventDefault();
			// 		var dx = (ev.clientX || ev.touches[0].clientX) - d.startPoint.x;
			// 		var dy = (ev.clientY || ev.touches[0].clientY) - d.startPoint.y;
			// 		if (Math.sqrt(dx*dx + dy*dy) > 8) {
			// 			clearTimeout(d.touchTimeout);
			// 		}
			// 	}
			// };
			// d.onmouseup = d.ontouchend = function(ev) {
			// 	d.down = false;
			// 	clearTimeout(d.touchTimeout);
			// };
			// d.ontouchcancel = function(ev) {
			// 	ev.preventDefault();
			// 	d.down = false;
			// 	clearTimeout(d.touchTimeout);
			// };

			folderDiv.appendChild(d);
			self.getImageThumbnailURL(name, function(thumbURL) {
				d.style.backgroundImage = 'url(' + thumbURL + ')';
			});

		}); // names.forEach

	}); // getSavedImageNames

};


FilePickerMixin.getImageThumbnailURL = function(name, callback, force) {
	this.thumbnailQueue.push({name: name, callback: callback, force: force});
	if (this.thumbnailQueue.length > 1) {
		return;
	}
	this.processThumbnailQueue();
};

FilePickerMixin.applyThumbnailQueue = function(name, url) {
	for (var i=0; i<this.thumbnailQueue.length; i++) {
		var task = this.thumbnailQueue[i];
		if (task.name === name) {
			task.callback(url);
			this.thumbnailQueue.splice(i, 1);
			i--;
		}
	}
	this.processThumbnailQueue();
};

FilePickerMixin.processThumbnailQueue = function() {
	if (this.thumbnailQueue.length === 0) {
		return;
	}

	var self = this;

	var currentTask = this.thumbnailQueue[0];
	var name = currentTask.name;

	this.getFromDB('thumbnails', name, function(thumbnail) {
		if (!thumbnail || currentTask.force) {
			self.loadImageFromDB(name, function(image) {
				var url;
				var lastSnap = image.snapshots[image.snapshots.length-1];
				console.log(image);
				if (lastSnap && lastSnap.state.texture) {
					var tex = lastSnap.state.texture;
					var c = document.createElement('canvas');
					c.width = tex.width;
					c.height = tex.height;
					
					console.log(tex.width, tex.height);

					var ctx = c.getContext('2d');
					var id = ctx.getImageData(0, 0, tex.width, tex.height);
					for (var y=0; y<tex.height; y++) {
						for (var x=0; x<tex.width; x++) {
							var j = (tex.width * (tex.height - 1 - y) + x) * 4;
							var i = (tex.width * y + x) * 4;
							id.data[j++] = tex.data[i++];
							id.data[j++] = tex.data[i++];
							id.data[j++] = tex.data[i++];
							id.data[j++] = tex.data[i++];
						}
					}
					ctx.putImageData(id, 0, 0);
					
					var imgC = document.createElement('canvas');
					var maxDim = 512;
					var f = 512 / Math.max(tex.width, tex.height);
					imgC.width = Math.ceil(tex.width * f);
					imgC.height = Math.ceil(tex.height * f);
					var imgCtx = imgC.getContext('2d');
					imgCtx.drawImage(c, 0, 0, imgC.width, imgC.height);
					url = imgC.toDataURL();
				} else {
					var c = document.createElement('canvas');
					c.width = c.height = 32;
					url = c.toDataURL();
				}
				self.putToDB('thumbnails', name, url);
				self.applyThumbnailQueue(name, url);

			}, function(error) {

				self.applyThumbnailQueue(name, '/texture.png');

			});
		} else {
			self.applyThumbnailQueue(name, thumbnail);
		}
	});

};
