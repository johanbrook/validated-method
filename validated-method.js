/* global ValidatedMethod:true */

ValidatedMethod = class ValidatedMethod {
  constructor(options) {
    // Default to no mixins
    options.mixins = options.mixins || [];
    check(options.mixins, [Function]);
    options = applyMixins(options, options.mixins);

    // connection argument defaults to Meteor, which is where Methods are defined on client and
    // server
    options.connection = options.connection || Meteor;

    // Allow validate: null shorthand for methods that take no arguments
    if (options.validate === null) {
      options.validate = function () {};
    }

    check(options, Match.ObjectIncluding({
      name: String,
      validate: Function,
      run: Function,
      mixins: [Function],
      connection: Object,
    }));

    _.extend(this, options);

    const method = this;
    this.connection.methods({
      [options.name](args) {
        // Silence audit-argument-checks since arguments are always checked when using this package
        check(args, Match.Any);
        const methodInvocation = this;

        return method._execute(methodInvocation, args);
      }
    });
  }

  call(args, callback) {
    // Accept calling with just a callback
    if (_.isFunction(args)) {
      callback = args;
      args = {};
    }

    const options = {
      // Make it possible to get the ID of an inserted item
      returnStubValue: true,

      // Don't call the server method if the client stub throws an error, so that we don't end
      // up doing validations twice
      // XXX needs option to disable, in cases where the client might have incomplete information to
      // make a decision
      throwStubExceptions: true
    };

    try {
      return this.connection.apply(this.name, [args], options, callback);
    } catch (err) {
      if (callback) {
        // Get errors from the stub in the same way as from the server-side method
        callback(err);
      } else {
        // No callback passed, throw instead of silently failing; this is what
        // "normal" Methods do if you don't pass a callback.
        throw err;
      }
    }
  }

  _execute(methodInvocation, args) {
    methodInvocation = methodInvocation || {};

    // Add `this.name` to reference the Method name
    methodInvocation.name = this.name;

    const validateResult = this.validate.bind(methodInvocation)(args);

    if (typeof validateResult !== 'undefined') {
      throw new Error(`Returning from validate doesn't do anything; \
perhaps you meant to throw an error?`);
    }

    return this.run.bind(methodInvocation)(args);
  }
};

// Mixins get a chance to transform the arguments before they are passed to the actual Method
function applyMixins(args, mixins) {
  // You can pass nested arrays so that people can ship mixin packs
  const flatMixins = _.flatten(mixins);

  flatMixins.forEach((mixin) => {
    args = mixin(args);
  });

  return args;
}
