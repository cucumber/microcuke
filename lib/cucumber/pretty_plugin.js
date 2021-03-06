var chalk = require('chalk');

var colors = {
  failed: chalk.red,
  passed: chalk.green,
  skipped: chalk.cyan,
  undefined: chalk.yellow,
  comment: chalk.gray
};

function stepColor(step) {
  return colors[step.status];
}

module.exports = function PrettyPlugin(out, sourceReader) {
  var sourcePrinters = {};
  var sourcePrinter; // Assumes sequential execution.

  this.subscribe = function (eventEmitter) {
    eventEmitter.on('scenario-started', function (scenario) {
      sourcePrinter = sourcePrinterFor(scenario);
      sourcePrinter.printLine(scenario.location);
    });

    eventEmitter.on('step-started', function (step) {
      if (step.gherkinLocation) { // Hook steps don't have a location - ignore them
        sourcePrinter.printUntilExcluding(step.gherkinLocation);
      }
    });

    eventEmitter.on('step-finished', function (step) {
      if (step.gherkinLocation) {
        sourcePrinter.printStep(step);
      }
      if (step.status == 'failed') {
        var indentedError = step.error.stack.replace(/^(.*)/gm, "      $1");
        var color = stepColor(step);
        out.write(color(indentedError) + "\n");
      }
    });
  };

  function sourcePrinterFor(scenario) {
    var sourcePrinter = sourcePrinters[scenario.location.path];
    if (!sourcePrinter) {
      var source = sourceReader.readSource(scenario.location.path);
      sourcePrinter = sourcePrinters[scenario.location.path] = new SourcePrinter(source);
    }
    sourcePrinter.commentIndents = getCommentIndents(scenario);

    return sourcePrinter;
  }

  function getCommentIndents(scenario) {
    var endColumns = scenario.pickleSteps.map(function (pickleStep) {
      var location = pickleStep.locations[pickleStep.locations.length - 1];
      return location.column + pickleStep.text.length;
    });
    var maxColumn = Math.max.apply(Math.max, endColumns);
    return endColumns.map(function (endColumn) {
      return maxColumn - endColumn;
    });
  }

  function SourcePrinter(source) {
    var lines = source.split(/\n/);
    var lineIndex = 0;

    this.printLine = function (location) {
      lineIndex = location.line - 1;
      out.write(lines[lineIndex] + "\n");
      lineIndex++;
    };

    this.printUntilExcluding = function (location) {
      while (lineIndex < location.line - 1) {
        out.write(lines[lineIndex] + "\n");
        lineIndex++;
      }
    };

    this.printStep = function (step) {
      var color = stepColor(step);

      var textStart = 0;
      var textLine = lines[lineIndex];
      var formattedLine = '';
      step.matchedArguments.forEach(function (matchedArgument) {
        var text = textLine.substring(textStart, matchedArgument.offset - 1);
        formattedLine += color(text);
        formattedLine += color.bold(matchedArgument.value);

        textStart = matchedArgument.offset - 1 + matchedArgument.value.length;
      });
      if (textStart != textLine.length) {
        var text = textLine.substring(textStart, textLine.length);
        formattedLine += color(text);
      }
      var locationForComment = step.bodyLocation || step.gherkinLocation;
      var comment = '# ' + locationForComment.path + ':' + locationForComment.line;
      formattedLine += ' ' + spaces(sourcePrinter.commentIndents.shift()) + colors.comment(comment);
      out.write(formattedLine + "\n");
      lineIndex++;
    };
  }

  function spaces(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ' ';
    return s;
  }
};
