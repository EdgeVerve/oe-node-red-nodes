/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
var loopback = require('loopback');
var utils = require('../common/utils');

/* eslint-disable guard-for-in */
/* eslint-disable no-empty */
/* eslint-disable no-loop-func */
module.exports = function (RED) {
  function removeOldObservers(Model, id, method) {
    var modelRemotes = Model.app._remotes.listenerTree.before[Model.modelName];
    var remote =  modelRemotes ? (modelRemotes[method] ? modelRemotes[method]._listeners : null) : null;
    if (remote) {
      if (Array.isArray(remote)) {
        for (var j in remote) {
          var remoteMethod = remote[j];

          var nodeId;

          // hack to get nodeId.
          try {
            remoteMethod({}, function (nId) {
              nodeId = nId;

              if (nodeId === id) {
                // Id matched. remove this observer
                // console.log('node id matched. removing this
                // observer.');
                remote.splice(j, 1);
                j--;
              }
            })();
          } catch (e) {
          }
        }
      } else {
        // hack to get nodeId.
        try {
          remote({}, function (nId) {
            nodeId = nId;
            // console.log('node id received from observer = ', nodeId);
            if (nodeId === id) {
              // Id matched. remove this observer
              // console.log('node id matched. removing this
              // observer.');
              delete modelRemotes[method];
              // remote.splice(j, 1);
              // j--;
            }
          })();
        } catch (e) {

        }
      }
    }
  }
  /* eslint-enable guard-for-in */
  /* eslint-enable no-empty */
  /* eslint-enable no-loop-func */

  function AsyncBeforeRemoteNode(config) {
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
    // var Model = loopback.findModel(modelName);
    var Model = loopback.findModel(modelName, node.callContext);
    if (Model) {
      node.status({fill: 'green', shape: 'dot', text: modelName});
      // Remove existing observers if any.
      // console.log('observers before removing = ', Model._observers);
      removeOldObservers(Model, node.id, method);
      // console.log('observers after removing = ', Model._observers);

      Model.beforeRemote(method, new AsyncBeforeRemote(node, modelName, method).observe);
    } else {
      node.status({fill: 'red', shape: 'dot', text: 'Invalid ModelName: ' + modelName});
      return this.error(RED._('asyncObserver.errors.modelNameInvalid'));
    }

    node.on('close', function () {
      // console.log('node is closing. removing observers')
      if (Model) {
        // console.log('observers before removing = ',
        // Model._observers);
        removeOldObservers(Model, node.id, method);
        // console.log('observers after removing = ', Model._observers);
      }
    });
  }
  RED.nodes.registerType('async-before-remote', AsyncBeforeRemoteNode);
};

var AsyncBeforeRemote = function (node, modelName, methodName) {
  var _node = node;
  var _modelName = modelName;
  var _methodName = methodName;

  this.observe = function (ctx, modelResult, next) {
    var id = _node.id;

    // sort of an hack to return a function in case this method is called by
    // node itself.
    if (ctx && Object.keys(ctx).length === 0) {
      next(id);
    } else {
      if ( !(ctx.req && ctx.req.callContext && ctx.req.callContext.ctx) ) {
        console.log('callContext not available');
        return next();
      }

      // var Model = loopback.getModel(_modelName);
      var Model = loopback.getModel(modelName, _node.callContext);


      if (!utils.compareContext(_node, { Model: Model, options: { ctx: ctx.req.callContext.ctx } })) {
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
      msg.ctx = ctx;
      _node.send(msg);

      // return control to loopback application.
      next();
    }
  };
};
