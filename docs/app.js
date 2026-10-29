      // Client ID and API key from the Developer Console
      var CLIENT_ID = '133534839514-6srelmk6gbv1h0abll2q70q614g8v93b.apps.googleusercontent.com';

      // Array of API discovery doc URLs for APIs used by the quickstart
      var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

      // Authorization scopes required by the API; multiple scopes can be
      // included, separated by spaces.
      var SCOPES = "https://www.googleapis.com/auth/calendar";
      const curYear = new Hebcal.HDate().year;

      var authorizeButton = document.getElementById('authorize_button');
      var signedin_div = document.getElementById('signedin_div');
      var signoutButton = document.getElementById('signout_button');
      var calendarSelect = document.getElementById('calendar_select');
      var fromYearSelect = document.getElementById('fromYear_select');
      var toYearSelect = document.getElementById('toYear_select');

      var fromYearP = document.getElementById('fromYear_p');
      var toYearP = document.getElementById('toYear_p');
      var deleteButton = document.getElementById('delete_button');
      var duplicateButton = document.getElementById('duplicate_button');
      var duplicateP = document.getElementById('duplicate_p');
      let tokenClient;
    let gapiInited;
    let gisInited;


    function checkBeforeStart() {
       if (gapiInited && gisInited){
          // Start only when both gapi and gis are initialized.
          showEvents();
       }
    }

    function gapiInit() {
      gapi.client.init({
        discoveryDocs: DISCOVERY_DOCS
        // NOTE: OAuth2 'scope' and 'client_id' parameters have moved to initTokenClient().
      })
      .then(function() {  // Load the Calendar API discovery document.
        // gapi.client.load("https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest");
        gapiInited = true;
        checkBeforeStart();
      });
    }

    function gapiLoad() {
        gapi.load('client', gapiInit)
    }

    function gisInit() {
     tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: '',  // defined at request time
            });
      gisInited = true;
      checkBeforeStart();
    }

    function showEvents() {

      tokenClient.callback = (resp) => {
        if (resp.error !== undefined) {
          throw(resp);
        }
        // GIS has automatically updated gapi.client with the newly issued access token.
        console.log('Calendar authorization completed.');
        updateSigninStatus(true);

      }

      // Conditionally ask users to select the Google Account they'd like to use,
      // and explicitly obtain their consent to fetch their Calendar.
      // NOTE: To request an access token a user gesture is necessary.
      if (gapi.client.getToken() === null) {
        // Prompt the user to select an Google Account and asked for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({prompt: ''}); // was prompt: 'consent'
      } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({prompt: ''});
      }
    }

    function revokeToken() {
      let cred = gapi.client.getToken();
      if (cred !== null) {
        google.accounts.oauth2.revoke(cred.access_token, () => {console.log('Calendar authorization revoked.')});
        gapi.client.setToken('');
        updateSigninStatus(false);
      }
    }
      /**
       *  Called when the signed in status changes, to update the UI
       *  appropriately. After a sign-in, the API is called.
       */
      function updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
          authorizeButton.style.display = 'none';
          // signoutButton.style.display = 'block';
          getCalendars().then(populateCalendars).then(function(){
            // calendar_select.onchange = populateFromYear;
            populateFromYear(fromYear_select,fromYear_p,-5,5);
            populateFromYear(toYear_select,toYear_p,-4,6);

            calendar_select.onchange = function() {
              fromYear_select.onchange();
              toYear_select.onchange();
            }

            delete_button.onclick = deleteTargetYearEvents;
            duplicate_button.onclick = duplicateHebrewEvents;

            signedin_div.style.display = 'block';
          });
        } else {
          authorizeButton.style.display = 'block';
          signedin_div.style.display = 'none';
        }
      }

      /**
       *  Sign in the user upon button click.
       */
      function handleAuthClick(event) {
        gapi.auth2.getAuthInstance().signIn();
      }

      /**
       *  Sign out the user upon button click.
       */
      function handleSignoutClick(event) {
        gapi.auth2.getAuthInstance().signOut();
      }

      /**
       * Append a pre element to the body containing the given message
       * as its text node. Used to display the results of the API call.
       *
       * @param {string} message Text to be placed in pre element.
       */
      function appendPre(message) {
        var pre = document.getElementById('content');
        var textContent = document.createTextNode(message + '\n');
        pre.appendChild(textContent);
      }

      /**
       * Print the summary and start datetime/date of the next ten events in
       * the authorized user's calendar. If no events are found an
       * appropriate message is printed.
       */

      function getStartOfEvent(event) {
        if (event.dateTime)
          return event.dateTime;
        return event.date;
      }

      function getSelectedValue(selectElement) {
        return selectElement.options[selectElement.selectedIndex].value;
      }

      function getCalendars() {
        return gapi.client.calendar.calendarList.list({
          'minAccessRole': "owner",
          'showDeleted': false,
          'showHidden': false,
          'maxResults': 50
        });
      }

      function populateCalendars(response) {
        const cals = response.result.items;
        if (cals.length > 0) {
          for (i = 0; i < cals.length; i++) {
            var cal = cals[i];
            var el = document.createElement("option");
            el.textContent = cal.summary;
            el.value = cal.id;
            calendar_select.appendChild(el);
          }
          // calendar_select.style.display = "block";
        }        
      }

      function getEventsByYear(hebYear) {
        var startDay = new Hebcal.HDate(1,7,hebYear);
        var endDay = new Hebcal.HDate(startDay).setFullYear(startDay.year+1);
        return gapi.client.calendar.events.list({
          'calendarId': getSelectedValue(calendar_select),
          'timeMin': (startDay.greg()).toISOString(),
          'timeMax': (endDay.greg()).toISOString(),
          'showDeleted': false,
          'singleEvents': true,
          'maxResults': 100,
          'orderBy': 'startTime'
        })
      }

      function countEventsFromYear(selector,paragraph) {
        getEventsByYear(getSelectedValue(selector))
        .then(function(response) {
            // paragraph.style.display = "block";
            paragraph.innerHTML = response.result.items.length + " אירועים נמצאו";
        });
      }

      function populateFromYear(selector,paragraph,minDelta,maxDelta) {
        selector.style.display = "none";

        selector.options.length = 0;
        for (i = minDelta; i < maxDelta; i++) {
          var el = document.createElement("option");          
          el.textContent = curYear+i;
          el.value = curYear+i;
          selector.appendChild(el);
        }
        selector.selectedIndex = 5;
        selector.style.display = "block";
        selector.onchange = function() {
          paragraph.innerHTML = "טוען...";
          countEventsFromYear(selector,paragraph);
        }
        countEventsFromYear(selector,paragraph);
      }

      function deleteTargetYearEvents() {
        getEventsByYear(getSelectedValue(toYear_select))
        .then(function(response) {
          var events = response.result.items;
          duplicateP.innerHTML = "מוחק אירועים בשנת היעד..."
          var batch = gapi.client.newBatch();
          if (events.length > 0) {
            for (i = 0; i < events.length; i++) {
              var event = events[i];
              // console.dir(event);
              batch.add(gapi.client.calendar.events.delete({
                'calendarId': getSelectedValue(calendar_select),
                'eventId': event.id
              }));
            }
            batch.then(function(e) {
              duplicateP.innerHTML = "נמחק בהצלחה";
              toYear_select.onchange();
            });
          }                     
        });
      }

      function nextHebOccurence(event,delta) {            
        var hd = new Hebcal.HDate(new Date(getStartOfEvent(event)));
        return hd.setFullYear(hd.year+delta).greg();
      }

      function duplicateHebrewEvents() {
       var opt = {
          calendarId: getSelectedValue(calendar_select),
          toYear: getSelectedValue(toYear_select),
          fromYear: getSelectedValue(fromYear_select)
       }
       duplicate_p.innerHTML = "משכפל...";
       var delta = opt.toYear - opt.fromYear;
       getEventsByYear(opt.fromYear)
        .then(function(response) {
          var events = response.result.items;
          var batch = gapi.client.newBatch();
          var descSuffix = "<p dir=rtl>אירוע זה נוצר על ידי <a href='https://eitan101.github.io/heb-google-cal/'>Hebrew Birthdays</a></p>"
          if (events.length > 0) {
            for (i = 0; i < events.length; i++) {
              var event = events[i];
              var desc = event.description.includes(descSuffix) ? event.description : event.description.concat("\n\n",descSuffix)
              batch.add(gapi.client.calendar.events.insert({
                'calendarId': opt.calendarId,
                'resource': {
                  'summary': event.summary,
                  'description': desc,
                  'start' : {
                    'dateTime':nextHebOccurence(event.start,delta).toISOString()
                  },
                  'end' : {
                    'dateTime':nextHebOccurence(event.end,delta).toISOString()
                  }
                }
              }));
            }
            duplicate_p.innerHTML = "משכפל "+events.length+" אירועים...";
            batch.then(function() {
              duplicate_p.innerHTML = "השכפול הסתיים בהצלחה"
              toYear_select.onchange();
            });
          } else {
            duplicate_p.innerHTML = "לא נמצאו אירועים."
          }
        });
      }
