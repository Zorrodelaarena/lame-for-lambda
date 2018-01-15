
var fs = require('fs');
var child_process = require('child_process');
var async = require('async');
var tmp = require('tmp');
var shellescape = require('shell-escape');

var lamePath = '';

/**
 * @typedef {Object} LameOptions
 * @property {?function} callback receives the results after finish
 * @property {InputParameters} input information about the input file
 * @property {OutputParameters} output information about the output file
 */

/**
 * @typedef {Object} InputParameters
 * @property {string} path to the file
 * @property {Array} parameters to be applied to the input file
 */

/**
 * @typedef {Object} OutputParameters
 * @property {string} path to the file
 * @property {?string} path to lame output file. if not specified, one will be generated
 * @property {?string} postfix if set and path is not, the generated file will end in this
 * @property {Array} parameters to be applied to the input file
 */

/**
 * @typedef {Object} LameResult
 * @property {Error} error set if there was an error
 * @property {int} size filesize of output file
 * @property {string} outputFile path to output file
 * @property {string} stdout stdout from lame
 * @property {string} stderr stderr from lame
 * @property {string} lameCommand the command that was run (if there was one) (for debugging)
*/

/**
 * Runs lame
 * @param {LameOptions} options
 * @returns {LameResult}
 */
exports.lame = function (options) {

	var result = {
		error: null,
		size: 0,
		outputFile: '',
		stdout: '',
		stderr: '',
		lameCommand: ''
	};

	if (typeof options !== 'object') {
		options = {};
	}

	var finalCallback = options['callback'];
	if (typeof finalCallback !== 'function') {
		finalCallback = function () { };
	}

	var lameParameters = [];
	if (!options.input || !options.input.path || !fs.existsSync(options.input.path)) {
		result.error = new Error('input.path not set or not found');
		finalCallback(result);
		return;
	}
	if (options.input.parameters && Array.isArray(options.input.parameters)) {
		lameParameters = lameParameters.concat(options.input.parameters);
	}
	lameParameters.push(options.input.path);

	if (!options.output || (!options.output.path && !options.output.postfix)) {
		result.error = new Error('output.path and output.postfix not set');
		finalCallback(result);
		return;
	}
	if (options.output.parameters && Array.isArray(options.output.parameters)) {
		lameParameters = lameParameters.concat(options.output.parameters);
	}
	if (!options.output.path) {
		result.outputFile = tmp.fileSync({ discardDescriptor: true, postfix: options.output.postfix }).name;
	} else {
		result.outputFile = options.output.path;
	}
	lameParameters.push(result.outputFile);

	async.waterfall([
		// make sure we have lame somewhere we can run it
		function (callback) {
			if (!lamePath || !fs.existsSync(lamePath)) {
				var newlamePath = tmp.fileSync({ discardDescriptor: true, prefix: 'lame-' }).name;
				child_process.exec('cp ' + __dirname + '/bin/lame ' + newlamePath, function (error, stdout, stderr) {
					if (error) {
						result.stdout = stdout;
						result.stderr = stderr;
						result.error = new Error('Failed to copy lame to ' + newlamePath);
						finalCallback(result);
					} else {
						lamePath = newlamePath;
						callback(null);
					}
				});
			} else {
				callback(null);
			}
		},
		// make sure we have run permissions
		function (callback) {
			fs.chmod(lamePath, 0777, function (err) {
				if (err) {
					result.error = err;
					finalCallback(result);
				} else {
					callback(null);
				}
			});
		},
		// run lame
		function (callback) {
			result.lameCommand = lamePath + ' ' + shellescape(lameParameters);
			child_process.exec(result.lameCommand, function (error, stdout, stderr) {
				result.size = fs.statSync(outputFile).size;
				result.stdout = stdout;
				result.stderr = stderr;
				if (result.size < 1) {
					result.error = new Error('outputFile was empty. check stdout and stderr for details');
				}
				finalCallback(result);
			});
		}
	]);
};
