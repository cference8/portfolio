$("#my-form").on("submit", function() {
    // Form script
	window.addEventListener('DOMContentLoaded', function () {
		// get the form elements defined in your form HTML above

		var form = document.getElementById('my-form');
		// var button = document.getElementById("my-form-button");
		var status = document.getElementById('status');

		// Success and Error functions for after the form is submitted

		function success() {
			form.reset();
			status.classList.add('success');
			status.innerHTML = "Thanks for your submission!";
		}

		function error() {
			status.classList.add('error');
			status.innerHTML = "Oops! There was a problem submitting your form";
			alert("Try again");
		}

		// handle the form submission event

		form.addEventListener('submit', function (ev) {
			ev.preventDefault();
			var data = new FormData(form);
			ajax(form.method, form.action, data, success, error);
		});
	});

  // helper function for sending an AJAX request

  function ajax(method, url, data, success, error) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;
        if (xhr.status === 200) {
            success(xhr.response, xhr.responseType);
        } else {
            error(xhr.status, xhr.response, xhr.responseType);
        }
    };
    xhr.send(data);
  }
});


function printDiv(divName) {
  var printContents = document.getElementById(divName).innerHTML,
    originalContents = document.body.innerHTML;
  (document.body.innerHTML = printContents),
    window.print(),
    (document.body.innerHTML = originalContents);
}
var myGamePiece,
  myObstacles = [],
  myScore;
function startGame() {
  ((myGamePiece = new component(
    30,
    30,
    "images/yellowbird.png",
    10,
    120,
    "image"
  )).gravity = 0.05),
    (myScore = new component("30px", "Consolas", "red", 420, 40, "text")),
    myGameArea.start();
}
var myGameArea = {
  canvas: document.createElement("canvas"),
  start: function () {
    (this.canvas.width = 711),
      (this.canvas.height = 400),
      (this.context = this.canvas.getContext("2d"));
    var myGame = document.getElementById("game");
    myGame.insertBefore(this.canvas, myGame.childNodes[0]),
      (this.frameNo = 0),
      (this.interval = setInterval(updateGameArea, 20));
  },
  clear: function () {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },
};
function component(width, height, color, x, y, type) {
  (this.type = type),
    "image" == type && ((this.image = new Image()), (this.image.src = color)),
    (this.score = 0),
    (this.width = width),
    (this.height = height),
    (this.speedX = 0),
    (this.speedY = 0),
    (this.x = x),
    (this.y = y),
    (this.gravity = 0),
    (this.gravitySpeed = 0),
    (this.update = function () {
      (ctx = myGameArea.context),
        "text" == this.type
          ? ((ctx.font = this.width + " " + this.height),
            ctx.fillText(this.text, this.x, this.y))
          : "image" == this.type
          ? ctx.drawImage(this.image, this.x, this.y, this.width, this.height)
          : ((ctx.fillStyle = color),
            ctx.fillRect(this.x, this.y, this.width, this.height));
    }),
    (this.newPos = function () {
      (this.gravitySpeed += this.gravity),
        (this.x += this.speedX),
        (this.y += this.speedY + this.gravitySpeed),
        this.hitBottom();
    }),
    (this.hitBottom = function () {
      var rockbottom = myGameArea.canvas.height - this.height;
      this.y > rockbottom && ((this.y = rockbottom), (this.gravitySpeed = 0));
    }),
    (this.crashWith = function (otherobj) {
      var myleft = this.x,
        myright = this.x + this.width,
        mytop = this.y,
        mybottom = this.y + this.height,
        otherleft = otherobj.x,
        otherright = otherobj.x + otherobj.width,
        othertop = otherobj.y,
        otherbottom = otherobj.y + otherobj.height,
        crash = !0;
      return (
        (mybottom < othertop ||
          mytop > otherbottom ||
          myright < otherleft ||
          myleft > otherright) &&
          (crash = !1),
        crash
      );
    });
}
function updateGameArea() {
  var x, height, gap, minHeight, maxHeight, minGap, maxGap;
  for (i = 0; i < myObstacles.length; i += 1)
    if (myGamePiece.crashWith(myObstacles[i])) return;
  for (
    myGameArea.clear(),
      myGameArea.frameNo += 1,
      (1 == myGameArea.frameNo || everyinterval(150)) &&
        ((x = myGameArea.canvas.width),
        (minHeight = 20),
        (maxHeight = 200),
        (height = Math.floor(181 * Math.random() + 20)),
        (minGap = 70),
        (maxGap = 200),
        (gap = Math.floor(131 * Math.random() + 70)),
        myObstacles.push(
          new component(40, height, "images/pipe-green-down.jpg", x, 0, "image")
        ),
        myObstacles.push(
          new component(
            40,
            x - height - gap,
            "images/pipe-green.jpg",
            x,
            height + gap,
            "image"
          )
        )),
      i = 0;
    i < myObstacles.length;
    i += 1
  )
    (myObstacles[i].x += -1), myObstacles[i].update();
  (myScore.color = "blue"),
    (myScore.text = "SCORE: " + myGameArea.frameNo),
    myScore.update(),
    myGamePiece.newPos(),
    myGamePiece.update();
}
function everyinterval(n) {
  return (myGameArea.frameNo / n) % 1 == 0;
}
function accelerate(n) {
  myGamePiece.gravity = n;
}
