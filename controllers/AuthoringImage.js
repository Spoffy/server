/* *****************************************************************************
 *
 * StoryPlaces
 *

 This application was developed as part of the Leverhulme Trust funded
 StoryPlaces Project. For more information, please visit storyplaces.soton.ac.uk

 Copyright (c) 2016
 University of Southampton
 Charlie Hargood, cah07r.ecs.soton.ac.uk
 Kevin Puplett, k.e.puplett.soton.ac.uk
 David Pepper, d.pepper.soton.ac.uk

 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:
 * Redistributions of source code must retain the above copyright
 notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in the
 documentation and/or other materials provided with the distribution.
 * The name of the Universities of Southampton nor the name of its
 contributors may be used to endorse or promote products derived from
 this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED. IN NO EVENT SHALL THE ABOVE COPYRIGHT HOLDERS BE LIABLE FOR ANY
 DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 ***************************************************************************** */

"use strict";

let AuthoringSchema = require('../models/authoringSchema');
let CoreSchema = require('../models/coreschema');
let helpers = require('./helpers.js');

let Authorisation = require('../auth/Authorisation');
let fs = require('fs');

var Logger = require('../utilities/Logger.js');
var File = require('../utilities/File.js');

exports.create = create;
exports.fetch = fetch;
exports.remove = remove;

function create(req, res, next) {

    let storyId = helpers.validateId(req.params.story_id);

    checkStoryOwnership(storyId, req.internal.userId, (ownershipError) => {

        if (ownershipError) {
            return next(ownershipError);
        }

        if (!req.file || !req.file.filename || !req.file.path || !req.file.mimetype) {
            let error = new Error("Bad image uploaded");
            error.response = 400;
            error.clientMessage = "Bad image";
            return next(error);
        }



        let id = req.file.filename.substr(0, req.file.filename.lastIndexOf('.'));

        let authoringImage = new AuthoringSchema.AuthoringImage({
            id: id,
            storyId: storyId,
            mimeType: req.file.mimetype
        });

        authoringImage.save(err => {
            if (err) {
                err.status = 400;
                err.message = "Unable to create image";
                return next(err);
            }

            createJSONFile(req.file.path, req.file.mimetype);

            res.json({
                message: "Image created",
                imageId: id
            });
        });
    });
}

function createJSONFile(filePath, mimetype) {
    let jsonData = {
        "contentType": mimetype,
        "content": File.base64EncodeFile(filePath)
    }

    let basePath = filePath.substr(0, filePath.lastIndexOf('.'));
    let jsonPath = basePath + '.json';

    File.createFile(jsonPath, JSON.stringify(jsonData));
}


function makePath(storyId) {
    return 'authoring-media/' + storyId + '/';
}

function fetch(req, res, next) {
    let storyId;
    let imageId;

    try {
        storyId = helpers.validateId(req.params.story_id);
        imageId = helpers.validateId(req.params.image_id);
    } catch (error) {
        return next(error);
    }

    checkStoryOwnership(storyId, req.internal.userId, (ownershipError) => {

        console.log("AA", ownershipError);

        if (ownershipError) {
            return next(ownershipError);
        }

        let fileOptions = {
            root: makePath(storyId),
            dotfiles: 'deny',
            maxAge: 60 * 24 * 1000
        };

        console.log(storyId, imageId);


        AuthoringSchema.AuthoringImage.find({id: imageId, storyId: storyId}, (err, authoringImage) => {
            let filename;

            if (err) {
                return next(err);
            }

            if (!authoringImage) {
                let error = new Error("Authoring Image id " + imageId + " for story " + storyId + " not found");
                error.status = 404;
                error.clientMessage = "Image not found";
                return next(error);
            }

            filename = imageId + '.json';

            res.sendfile(filename, fileOptions, err => {
                if (err) {
                    err.satus = 404;
                    return next(err);
                }

                Logger.log("Served media " + filename);
            });
        });

    });
}

function remove(req, res, next) {

}

function checkStoryOwnership(storyId, userId, callback) {
    AuthoringSchema.AuthoringStory.findById(storyId, (err, authoringStory) => {
        if (err) {
            return callback(err);
        }

        if (!authoringStory) {
            let error = new Error("No such story " + storyId);
            error.status = 404;
            error.clientMessage = "Not found";
            return callback(error)
        }

        if (authoringStory.authorIds.indexOf(userId) === -1) {
            let error = new Error("User is not an author on this story");
            error.status = 401;
            error.clientMessage = "Permission denied";
            return callback(error)
        }

        callback(undefined);
    });
}