'use strict'
/* ---------------ACTOR---------------------- */
const mongoose = require('mongoose')
const Finder = require('../models/finder')
const Actor = mongoose.model('Actors')
const admin = require('firebase-admin')
const authController = require('./authController')
var logger = require('../../logger.js')

exports.list_all_actors = function (req, res) {
  Actor.find({}, function (err, actors) {
    if (err) {
      res.send(err)
    } else {
      res.json(actors)
    }
  })
}

function createActorDB(req, res){
  const newActor = new Actor(req.body)
      const newFinder = new Finder()
      newFinder.actor = newActor._id;
      newActor.save(function (err, actor) {
        if (err) {
          res.send(err)
        } else {
          newFinder.save(function (err, finder) {
            if (err) {
              res.send(err)
            } else {
              res.json({ actor: actor, finder: finder })
            }
          })
        }
      })
}

exports.create_an_actor = function (req, res) {
  if (req.body.role != undefined && req.body.role != "EXPLORER"){
    res.send("The user role can only be EXPLORER.")
  }else if(req.body.active != undefined && req.body.active != true){
    res.send("The new user must be active.")
  }else{
    createActorDB(req, res);
  }
}

exports.create_an_actor_with_auth = async function (req, res) {
  const idToken = req.headers.idtoken // WE NEED the FireBase custom token in the req.header... it is created by FireBase!!
  const authenticatedUser = await authController.getUserId(idToken);
  if(authenticatedUser!=null){
    if (authenticatedUser.role=='ADMINISTRATOR'){
      createActorDB(req, res);
    }else{
      res.send("Authenticated users can't register to the system.")
    }
  }else{
    if (req.body.role != undefined && req.body.role != "EXPLORER"){
      res.send("The user role can only be EXPLORER.")
    }else if(req.body.active != undefined && req.body.active != true){
      res.send("The new user must be active.")
    }else{
      createActorDB(req, res);
    }
    
  }
  
}

exports.read_an_actor = function (req, res) {
  Actor.findById(req.params.actorId, function (err, actor) {
    if (err) {
      res.send(err)
    } else {
      res.json(actor)
    }
  })
}
exports.read_an_actor_with_auth = async function (req, res) {
  const idToken = req.headers.idtoken // WE NEED the FireBase custom token in the req.header... it is created by FireBase!!
  const authenticatedUser = await authController.getUserId(idToken);
  if(authenticatedUser!=null){
    if (authenticatedUser._id==req.params.actorId || authenticatedUser.role=='ADMINISTRATOR'){
      Actor.findById(req.params.actorId, function (err, actor) {
        if (err) {
          res.send(err)
        } else {
          res.json(actor)
        }
      })
  }
    else {
      res.status(405); // Not allowed
      res.send('Seeing a profile of other actor is not allowed.');
    }
  }else {
    res.status(405); // Not allowed
    res.send('The Actor does not exist');
  }
}

exports.update_an_actor = function (req, res) {
  Actor.findOneAndUpdate({ _id: req.params.actorId }, req.body, { new: true }, function (err, actor) {
    if (err) {
      res.send(err)
    } else {
      res.json(actor)
    }
  })
}

exports.update_an_actor_with_auth = async function (req, res) {
  const idToken = req.headers.idtoken // WE NEED the FireBase custom token in the req.header... it is created by FireBase!!
  const authenticatedUser = await authController.getUserId(idToken);
  if(authenticatedUser!=null){
    if (authenticatedUser._id==req.params.actorId){
        Actor.findOneAndUpdate({ _id: req.params.actorId }, req.body, { new: true }, function (err, actor) {
          if (err) {
            res.send(err)
          } else if (req.body.role != undefined && authenticatedUser.role!='ADMINISTRATOR' && req.body.role != authenticatedUser.role){
            res.send("Non admin users can't change their role.")
          }else if(req.body.active != undefined && authenticatedUser.role!='ADMINISTRATOR' && req.body.active != authenticatedUser.active){
            res.send("Non admin users can't ban or unban any user.")
          }
          else {
            res.json(actor)
          }
        })
  }else if (authenticatedUser.role=='ADMINISTRATOR'){
      Actor.findOneAndUpdate({ _id: req.params.actorId }, {active:req.body.active, role: req.body.role}, { new: true }, function (err, actor) {
        if (err) {
          res.send(err)
        } else {
          res.json(actor)
        }
      })
  }else {
      res.status(405); // Not allowed
      res.send("Can't update other user's profiles.");
    }
  }else {
    res.status(405); // Not allowed
    res.send('The Actor does not exist');
  }
}

exports.delete_an_actor = function (req, res) {
  Actor.deleteOne({ _id: req.params.actorId }, function (err, actor) {
    if (err) {
      res.send(err)
    } else {
      res.json({ message: 'Actor successfully deleted' })
    }
  })
}

exports.login_an_actor = async function (req, res) {
  logger.warn('starting login an actor')
  const emailParam = req.query.email
  const password = req.query.password
  let customToken

  Actor.findOne({ email: emailParam }, function (err, actor) {
    if (err) { // No actor found with that email as username
      res.send(err)
    } else if (!actor) { // an access token isn’t provided, or is invalid
      res.status(401)
      res.json({ message: 'forbidden', error: err })
    } else if ((actor.role.includes('EXPLORER')) && (actor.active === false)) { // an access token is valid, but requires more privileges
      res.status(403)
      res.json({ message: 'forbidden', error: err })
    } else {
      // Make sure the password is correct
      actor.verifyPassword(password, async function (err, isMatch) {
        if (err) {
          res.send(err)
        } else if (!isMatch) { // Password did not match
          res.status(401) // an access token isn’t provided, or is invalid
          res.json({ message: 'forbidden', error: err })
        } else {
          try {
            customToken = await admin.auth().createCustomToken(actor.email)
          } catch (error) {
            logger.error('Error creating custom token:', error)
          }
          actor.customToken = customToken
          res.json(actor)
        }
      })
    }
  })
}

exports.update_a_verified_actor = function (req, res) {
  // Managers and Explorers can update theirselves, administrators can update any actor
  logger.info('Starting to update the verified actor...')
  Actor.findById(req.params.actorId, async function (err, actor) {
    if (err) {
      res.send(err)
    } else {
      logger.info('actor: ' + actor)
      const idToken = req.headers.idtoken // WE NEED the FireBase custom token in the req.header... it is created by FireBase!!
      const authenticatedUser = await authController.getUserId(idToken)
      if (authenticatedUser.role === "MANAGER" || authenticatedUser.role === "EXPLORER") {
        const authenticatedUserId = authenticatedUser._id

        if (authenticatedUserId == req.params.actorId) {
          Actor.findOneAndUpdate({ _id: req.params.actorId }, req.body, { new: true }, function (err, actor) {
            if (err) {
              res.send(err)
            } else {
              res.json(actor)
            }
          })
        } else {
          res.status(403) // Auth error
          res.send('The Actor is trying to update an Actor that is not himself!')
        }
      } else if (authenticatedUser.role === "ADMINISTRATOR") {
        Actor.findOneAndUpdate({ _id: req.params.actorId }, req.body, { new: true }, function (err, actor) {
          if (err) {
            res.send(err)
          } else {
            res.json(actor)
          }
        })
      } else {
        res.status(405) // Not allowed
        res.send('The Actor has unidentified roles')
      }
    }
  })
}