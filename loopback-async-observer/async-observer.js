/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
var loopback = require('loopback');
var utils = require('../common/utils');

module.exports = function (RED) {
  function AsyncObserverNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.status({});
    var modelName = config.modelname;
    var method = config.method;
    if (!modelName || modelName.trim() === '') {
      node.status({fill: 'red', shape: 'dot', text: 'ModelName not Set'});
      return  this.warn(RED._('asyncObserver.errors.modelNameNotSet'));
    }
    if (!method || method.trim() === '') {
      node.status({fill: 'red', shape: 'dot', text: 'Method not Set'});
      return this.warn(RED._('asyncObserver.errors.methodNotSet'));
    }

    var Model = loopback.findModel(modelName, node.callContext);

    if (Model) {
      node.status({fill: 'green', shape: 'dot', text: modelName});
      // console.log ('Model = ', Model._observers[method][0]);

      // Remove existing observers if any.
      // console.log('observers before removing = ', Model._observers);
      utils.removeOldObservers(Model, node.id);
      // console.log('observers after removing = ', Model._observers);

      Model.observe(method, new AsyncObserver(node, modelName, method).observe);
    } else {
      node.status({fill: 'red', shape: 'dot', text: 'Invalid ModelName: ' + modelName});
      return this.error(RED._('asyncObserver.errors.modelNameInvalid'));
    }
    node.on('close', function () {
      // console.log('node is closing. removing observers')
      if (Model) {
        // console.log('observers before removing = ',
        // Model._observers);
        utils.removeOldObservers(Model, node.id);
        // console.log('observers after removing = ', Model._observers);
      }
    });
  }
  RED.nodes.registerType('async-observer', AsyncObserverNode);
};

var AsyncObserver = function (node, modelName, methodName) {
  var _node = node;
  var _modelName = modelName;
  var _methodName = methodName;

  this.observe = function (ctx, next) {
    var id = _node.id;

    // sort of an hack to return a function in case this method is called by
    // node itself.
    if (!ctx && !next) {
      var getNRId = function () {
        return id;
      };

      return getNRId;
    }

    if (!utils.compareContext(_node, ctx)) {
      return next();
    }

    var msg = {};

    if (ctx.Model) {
      msg.payload = ctx.Model.definition.name + '.' + _methodName + ' triggered';
    } else {
      msg.payload = _modelName + '.' + _methodName + ' triggered';
    }

    msg.callContext = _node.callContext;

    // msg.next = next;
    msg.ctx = JSON.parse(JSON.stringify(ctx));
    _node.send(msg);

    // return control to loopback application.
    next();
  };


  this.observe.getId = function () {
    return _node.id;
  };
};
