var TestCase = require('./test_case');
var TestStep = require('./test_step');

module.exports = function Glue(stepDefinitions, hooks) {
  this.createTestCase = function (pickle) {
    var testSteps = []
      .concat(createHookSteps(pickle, 'before'))
      .concat(createPickleTestSteps(pickle))
      .concat(createHookSteps(pickle, 'after'));
    return new TestCase(pickle, testSteps);
  };

  function createHookSteps(pickle, scope) {
    return hooks.filter(function (hook) {
      return hook.scope === scope; // TODO: AND matches pickle's tags
    }).map(function (hook) {
      return hook.createTestStep(pickle);
    });
  }

  function createPickleTestSteps(pickle) {
    return pickle.steps.map(function (pickleStep) {
      var testSteps = stepDefinitions.map(function (stepDefinition) {
        return stepDefinition.createTestStep(pickleStep);
      }).filter(function (testStep) {
        return testStep != null;
      });

      switch (testSteps.length) {
        case 1:
          return testSteps[0];
        case 0:
          // Create an undefined step (null bodyFn)
          return new TestStep(pickleStep.locations, [], null, null);
        default:
          throw new Error("Ambiguous match");
      }
    });
  }
};
