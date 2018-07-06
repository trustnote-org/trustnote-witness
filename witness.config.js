module.exports = {
  apps : [{
    name   : "witness",
    script : "./start.js",
    "watch": true,
    "out_file": "/dev/null",
    "error_file": "/dev/null",
    "log_file": "combined.log",
    "log_date_format" : "YYYY-MM-DD HH:mm Z"
  }]
}
