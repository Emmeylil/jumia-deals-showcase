// Google Apps Script to be added to your Google Sheet
// To use: Tools -> Extensions -> Apps Script
// Paste this code and save. Refresh your sheet to see the "Catalog Sync" menu.

function onOpen() {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🚀 Catalog Sync')
        .addItem('Sync Catalog Now', 'syncToCatalog')
        .addToUi();
}

function syncToCatalog() {
    // Replace with your actual Supabase Edge Function URL
    var url = "https://kumviblyaqnypbiokggf.supabase.co/functions/v1/sync-catalog";

    // Replace with your Supabase Anon Key (found in your Supabase project settings)
    var anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1bXZpYmx5YXFueXBiaW9rZ2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTE4ODcsImV4cCI6MjA4NjgyNzg4N30.AQR1wtJswvpxIM5VxCLp0tKTBOJZNVy_Q0fOLWsLRc8";

    var options = {
        'method': 'post',
        'contentType': 'application/json',
        'headers': {
            'Authorization': 'Bearer ' + anonKey
        },
        'muteHttpExceptions': true
    };

    var ui = SpreadsheetApp.getUi();
    ui.showModelessDialog(HtmlService.createHtmlOutput("Syncing with catalog... please wait."), "Syncing");

    try {
        var response = UrlFetchApp.fetch(url, options);
        var responseCode = response.getResponseCode();
        var responseContent = response.getContentText();

        if (responseCode == 200) {
            ui.alert('✅ Sync Success!\n\nYour catalog has been updated with the latest prices and brand names from this sheet.');
        } else {
            ui.alert('❌ Sync Failed (' + responseCode + ')\n\nError: ' + responseContent);
        }
    } catch (e) {
        ui.alert('❌ Connection Error\n\n' + e.toString());
    }
}
