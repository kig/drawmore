(function() {
	var ERange = {};
	ERange.init = function(range) {
		var knob = document.createElement('div');
		knob.className = 'knob';
		range.appendChild(knob);
		Object.defineProperty(range, 'value', {
			get: function() {
				return this.__value;
			},

			set: function(v) {
				this.__value = v;
				this.updateKnob();
			}
		})

		range.updateKnob = function() {
			knob.style.left = 100 * (this.value - this.min) / (this.max-this.min) + '%';
			this.setAttribute('value', Math.round(this.value * 100)/100);
		};

		range.moveKnobBy = function(dx) {
			var vPerPx = (this.max-this.min) / this.getBoundingClientRect().width;
			this.value = Math.clamp(this.value + dx * vPerPx, this.min, this.max);
		};

		range.value = parseFloat(range.getAttribute('value'));
		range.min = parseFloat(range.getAttribute('min'));
		range.max = parseFloat(range.getAttribute('max'));

		var down = false;
		var downX = 0;
		range.onmousedown = function(ev) {
			if (ev.preventDefault) { ev.preventDefault(); }
			down = true;
			downX = ev.clientX;
		};
		var move = function(ev) {
			if (down) {
				if (ev.preventDefault) { ev.preventDefault(); }
				var dx = ev.clientX - downX;
				downX = ev.clientX;
				range.moveKnobBy(dx);
				if (range.oninput) {
					range.oninput();
				}
			}
		};
		var up = function(ev) {
			if (down) {
				if (ev.preventDefault) { ev.preventDefault(); }
				down = false;
				if (range.onchange) {
					range.onchange();
				}
			}
		};
		window.addEventListener('mousemove', move, false);
		window.addEventListener('mouseup', up, false);


		range.addEventListener('touchstart', function(ev) { ev.preventDefault(); range.onmousedown(ev.touches[0]); }, false);
		range.addEventListener('touchmove', function(ev) { ev.preventDefault(); move(ev.touches[0]); }, false);
		range.addEventListener('touchend', up, false);
		range.addEventListener('touchcancel', up, false);

		range.updateKnob();
	};

	var ranges = document.querySelectorAll('.range');
	for (var i=0; i<ranges.length; i++) {
		ERange.init(ranges[i]);
	}
})();