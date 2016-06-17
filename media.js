var express =   require("express");
var multer  =   require('multer');
var app     =   express();

module.exports = {
	media : {},
	setup: function (valid_req){
		var storage =   multer.diskStorage({
		  destination: function (req, file, callback) {
		    callback(null, './uploads');
		  },
		  filename: function (req, file, callback) {
		    callback(null, file.fieldname + '-' + Date.now());
		  }
		});

		var upload = multer({ storage : storage}).single('media');

		app.post('/media', function(req, res) {
			var session_id = valid_req(req);
			if (session_id){
			    upload(req, res, function(err) {
			        if (err) {
			            return res.end('{"message":"Error uploading file.", "error": true}');
			        }
			        if (!this.media[session_id]){
			        	this.media[session_id] = [];
			        }
			        this.media[session_id].push(req.files['media']);
			        res.end('{"message":File is uploaded", "error": false}');
			    }.bind(this));
			}
		}.bind(this));

		app.listen(3000, function(){
		    console.log("Uploading on port 3000");
		});
	}

};