'use strict';

(function() {
  var omletrtc;
  if ('undefined' === typeof module) {
    omletrtc = this.omletrtc = {};
  } else {
    omletrtc = module.exports = {};
  }

  // Holds the STUN/ICE server to use for PeerConnections.
  omletrtc.SERVER = function() {
    if (navigator.mozGetUserMedia) {
      return {
        "iceServers": [{
          "url": "stun:23.21.150.121"
        }]
      };
    }
    return {
      "iceServers": [{
        "url": "stun:stun.l.google.com:19302"
      }]
    };
  };

  // Reference to the Omlet documents.
  omletrtc.documentApi;
  omletrtc.myDocId;
  omletrtc.chatDoc;

  // Reference to the lone PeerConnection instance.
  omletrtc.peerConnection;

  // PeerConnection configuration
  omletrtc.pc_constraints = {
    'optional': [{ 'DtlsSrtpKeyAgreement': true }],
    'mandatory': { googIPv6: true }
  };

  // Operate only once offer and answer
  omletrtc.flag = true;

  // Stream-related variables.
  omletrtc.localStream;
  omletrtc.remoteStream;
  omletrtc.localVideoSource = true;

  // media constraints
  omletrtc.constraints = {
    audio: false,
    video: omletrtc.localVideoSource
  };
  

  omletrtc.createPeerConnection = function (data, video) {
    try {
      omletrtc.peerConnection = new RTCPeerConnection(omletrtc.SERVER(), omletrtc.pc_constraints);
      omletrtc.peerConnection.addStream(omletrtc.localStream);
    } catch (e) {
      log('[-] Failed to create RTCPeerConnection: ' + e.message);
      return;
    }

    if(video) {
      omletrtc.peerConnection.onaddstream = function (event) {
        attachMediaStream(remoteVideo, event.stream);
        omletrtc.remoteStream = event.stream;
      };
    }
  };

  omletrtc.createOffer = function () {
    omletrtc.peerConnection.createOffer(function (sessionDescription) {
      omletrtc.peerConnection.setLocalDescription(sessionDescription, function () {
        var param_sdp = {
          sender : Omlet.getIdentity().name,
          sessionDescription : sessionDescription
        };
        omletrtc.documentApi.update(omletrtc.myDocId, omletrtc.addMessage, param_sdp, function () {
            omletrtc.documentApi.get(omletrtc.myDocId, function () {});
          }, omletrtc.errorCallback);
        omletrtc.peerConnection.onicecandidate = omletrtc.handleIceCandidate;
        omletrtc.peerConnection.oniceconnectionstatechange = omletrtc.handleIceCandidateChange;
      }, omletrtc.errorCallback);
    }, omletrtc.errorCallback, sdpConstraints);
  };

  omletrtc.createAnswer = function () {
    log('[+] createAnswer.');
    omletrtc.peerConnection.createAnswer(function (sessionDescription) {
      omletrtc.peerConnection.setLocalDescription(sessionDescription, function () {
        var param_sdp = {
          sender : Omlet.getIdentity().name,
          sessionDescription : sessionDescription
        };
        omletrtc.documentApi.update(omletrtc.myDocId, omletrtc.addMessage, param_sdp, function () {
            omletrtc.documentApi.get(omletrtc.myDocId, function () {});
          }, omletrtc.errorCallback);
        // Sends ice candidates to the other peer
        omletrtc.peerConnection.onicecandidate = omletrtc.handleIceCandidate;
        omletrtc.peerConnection.oniceconnectionstatechange = omletrtc.handleIceCandidateChange;
      }, omletrtc.errorCallback);
    }, omletrtc.errorCallback, sdpConstraints);
  };

  omletrtc.handleUserMedia = function (stream) {
    log("creator: "+ omletrtc.chatDoc.creator.name);
    omletrtc.localStream = stream;
    attachMediaStream(localVideo, stream);

    // both 
    omletrtc.createPeerConnection(false, true);

    // only callee
    if(omletrtc.chatDoc.creator.name !== Omlet.getIdentity().name) {
      var param_userJoin = {
        userJoin : true,
        sender : Omlet.getIdentity().name
      };
      omletrtc.documentApi.update(omletrtc.myDocId, omletrtc.addMessage, param_userJoin, function () {
        omletrtc.documentApi.get(omletrtc.myDocId, function () {});
      }, omletrtc.errorCallback);
    }
  };

  omletrtc.handleIceCandidate = function (event) {
    if (event.candidate) {
      var param_iceCandidate = {
        sender : Omlet.getIdentity().name,
        label : event.candidate.sdpMLineIndex,
        id : event.candidate.sdpMid,
        candidate : event.candidate.candidate
      };
      omletrtc.documentApi.update(omletrtc.myDocId, omletrtc.addMessage, param_iceCandidate , function () {
        omletrtc.documentApi.get(omletrtc.myDocId, function () {});
      }, omletrtc.errorCallback);
    } else {
      log('[-] handleIceCandidate event.');
    }
  };

  omletrtc.handleIceCandidateChange = function (event) {
    var pc = omletrtc.peerConnection;
    log('[+] iceGatheringState: ' + pc.iceGatheringState + ', iceConnectionState: ' + pc.iceConnectionState);
  }

  omletrtc.sessionTerminated = function () {
    omletrtc.peerConnection.dispose();
    omletrtc.localStream.dispose();
    omletrtc.remoteStream.dispose();

    if (omletrtc.peerConnection) omletrtc.peerConnection.close();
    omletrtc.peerConnection = null;
  }


  /*****************************************************************
  *
  * Omlet.document = {
  *   create: function(success, error),
  *   get: function(reference, success, error),
  *     // The successful result of get is the document itself.
  *   update: function(reference, func, parameters, success, error),
  *   watch: function(reference, onUpdate, success, error),
  *     // The updateCallback argument to watch is called every time the document changes, for example
  *     // because it is being updated by another user. It receives the new document as its only argument.
  *   unwatch: function(reference, success, error)
  * }
  *
  *****************************************************************/

  /*
  *  Ignore everything below.
  */
  omletrtc.initDocumentAPI = function () {
    if (!Omlet.isInstalled())  {
      log("[-] Omlet is not installed." );
    }
    omletrtc.documentApi = Omlet.document;
    omletrtc._loadDocument();
  };
  
  omletrtc.DocumentCreated = function (doc) {
    var info = omletrtc.doc_info;
    var callbackurl = info.callback + "#/docId/" + omletrtc.myDocId;

    if(Omlet.isInstalled()) {
      var rdl = Omlet.createRDL({
        appName: info.appName,
        noun: info.noun,
        displayTitle: info.displayTitle,
        displayThumbnailUrl: info.displayThumbnailUrl,
        displayText: info.displayText,
        json: doc,
        callback: callbackurl
      });
      Omlet.exit(rdl);
    }
  };

  omletrtc._loadDocument = function () {
    if (omletrtc.hasDocument()) {
      omletrtc.myDocId = omletrtc.getDocumentReference();
      log("[+] Get documentReference id: " + omletrtc.myDocId );

      omletrtc.documentApi.watch(omletrtc.myDocId, function (chatDocId) {
        omletrtc.documentApi.get(chatDocId, omletrtc.handleMessage, omletrtc.errorCallback);
      }, function () {
        log("[+] Success to documentApi.watch.");
      }, omletrtc.errorCallback);

      omletrtc.documentApi.get(omletrtc.myDocId, function (doc) {
        omletrtc.ReceiveDoc(doc);
        if(window.location.href.indexOf("index.html")!=-1){
          joinAV();
        }
      }, omletrtc.errorCallback);
    } else {
      log("[-] Document is not found." );
    }
  };

  omletrtc.updateCallback = function (chatDocId) {
    omletrtc.documentApi.get(chatDocId, omletrtc.handleMessage, omletrtc.errorCallback);
  };

  omletrtc.getDocumentReference = function () {
    var docIdParam = window.location.hash.indexOf("/docId/");
    if (docIdParam == -1) return false;

    var docId = window.location.hash.substring(docIdParam + 7);
    var end = docId.indexOf("/");

    if (end != -1)
      docId = docId.substring(0, end);

    return docId;
  };

  omletrtc.hasDocument = function () {
    var docIdParam = window.location.hash.indexOf("/docId/");
    return (docIdParam != -1);
  };
  
  omletrtc.ReceiveDoc = function (doc) {
    omletrtc.chatDoc = doc;
  };

  omletrtc.DocumentCleared = function (doc) {
    log("[+] Document cleared");
  }

  omletrtc.Initialize = function (old, parameters) {
    return parameters;
  }
  
  omletrtc.errorCallback = function (error) {
    log("[-] " + error);
  }

}).call(this);

