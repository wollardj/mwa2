function do_resize() {
    $('#item_editor').height($(window).height() - 180);
    //ace editor is dumb and needs the height specifically as well
    $('#plist').height($(window).height() - 180);
    $('#item_list').height($(window).height() - 100);
}

$(window).resize(do_resize);

$(document).ready(function() {
    initPkginfoTable();
    hash = window.location.hash;
    if (hash.length > 1) {
        getPkginfoItem(hash.slice(1));
    }
    getCatalogNames();
    getCatalogData();
    searchField = $('#listSearchField');
    searchField.focus();
    do_resize();
} );


function select_catalog(name) {
    $('#catalog_dropdown').html(name + ' <span class="caret"></span>');
    $('#catalog_dropdown').data('value', name);
    var dt = $('#list_items').DataTable();
    dt.rows().invalidate();
    dt.draw();
}


function update_catalog_dropdown_list() {
    var catalog_list = $('#data_storage').data('catalog_names');
    var list_html = '<li><a href="#" onClick="select_catalog(\'all\')">all</a></li>\n';
    for (var i=0; i < catalog_list.length; i++) {
        list_html += '<li><a href="#" onClick="select_catalog(\''+ catalog_list[i] + '\')">' + catalog_list[i] + '</a></li>\n';
    }
    $('#catalog_dropdown_list').html(list_html);
}


function getCatalogNames() {
    var catalogListURL = '/catalogs/';
    $.ajax({
      method: 'GET',
      url: catalogListURL,
      timeout: 5000,
      global: false,
      cache: false,
      success: function(data) {
          $('#data_storage').data('catalog_names', data);
          // jQuery doesn't actually update the DOM; in order that we
          // can see what's going on, we'll also update the DOM item
          $('#data_storage').attr('data-catalog_names', data);
          update_catalog_dropdown_list();
      },
    });
}


function getValidInstallItems() {
    // return a list of valid install item names
    var data = $('#data_storage').data('catalog_data');
    if (data) {
        var catalog_list = Object.keys(data);
        var suggested = [];
        for (var i=0, l=catalog_list.length; i<l; i++) {
            var catalog_name = catalog_list[i];
            if ( data.hasOwnProperty(catalog_name) ) {
                Array.prototype.push.apply(suggested, data[catalog_name]['suggested']);
                Array.prototype.push.apply(suggested, data[catalog_name]['updates']);
                Array.prototype.push.apply(suggested, data[catalog_name]['with_version']);
            }
        }
        return uniques(suggested);
    } else {
        return [];
    }
}


$.fn.dataTable.ext.search.push(
    function( settings, searchData, index, rowData, counter ) {
        // custom search filter to filter out rows that have no versions
        // in the current catalog
        var catalog = $('#catalog_dropdown').data('value'),
            column = rowData[1];
        for(var i = 0; i < column.length; i++) {
            if (catalog == 'all' || column[i][1].indexOf(catalog) != -1) {
                // found our catalog
                return true;
            }
        }
        // didn't find the catalog, so filter this row out
        return false;
    }
);


var render_versions = function(data, type, row, meta) {
    var html = '<ul class="list">\n';
    var catalog_filter = $('#catalog_dropdown').data('value');
    for(var i = 0; i < data.length; i++) {
        if (catalog_filter == 'all' || data[i][1].indexOf(catalog_filter) != -1) {
            html += '<li><a href="#' + data[i][2] + '" onClick="getPkginfoItem(\'' + data[i][2] + '\')">' + data[i][0] + '</a></li>\n';
        }
    }
    html += '</ul>\n';
    return html
}


var render_name = function(data, type, row, meta) {
    data = data.replace(".", "<wbr/>.");
    data = data.replace("_", "<wbr/>_");
    return data;
}


function initPkginfoTable() {
    $('#list_items').dataTable({
        ajax: {
            url: "/pkgsinfo/json",
            cache: false,
            dataSrc: "",
            complete: function(jqXHR, textStatus){
                  window.clearInterval(poll_loop);
                  $('#process_progress').modal('hide');
                },
            global: false,
        },
        columnDefs: [
         { "targets": 0,
            "width": "60%",
            "render": render_name,
         },
         {
            "targets": 1,
            "render": render_versions,
            "searchable": false,
          }],
         "sDom": "<t>",
         "bPaginate": false,
         "scrollY": "1280px",
         "bInfo": false,
         "bFilter": true,
         "bStateSave": false,
         "aaSorting": [[0,'asc']]
     });
     // start our monitoring timer loop
     monitor_pkgsinfo_list();
     // tie our search field to the table
     var thisTable = $('#list_items').DataTable(),
         searchField = $('#listSearchField');
     searchField.keyup(function(){
         thisTable.search($(this).val()).draw();
     });
     //searchField.trigger('keyup');
}


function cancelEdit() {
    //$('#cancelEditConfirmationModal').modal('hide');
    $('.modal-backdrop').remove();
    hideSaveOrCancelBtns();
    getPkginfoItem(current_pathname);
}


function setupView(viewName) {
    selected_tab_viewname = viewName;
    if (viewName == '#basicstab') {
        constructBasics();
    } else if (viewName == '#detailtab') {
        constructDetail();
    } else if (viewName == '#plisttab') {
        editor.focus();
        editor.resize(true);
    }
}

function constructBasics() {
    if (js_obj != null) {
        $('#basics').html('')
        $('#basics').plistEditor(js_obj,
            { change: updatePlistAndDetail,
              keylist: key_list,
              keytypes: keys_and_types,
              validator: validator});
    } else {
        $('#basics').html('<br/>Invalid plist.')
    }
    setupTypeahead();
}


function constructDetail() {
    if (js_obj != null) {
        $('#detail').html('')
        $('#detail').plistEditor(js_obj, 
            { change: updatePlistAndBasics,
              keytypes: keys_and_types,
              validator: validator});
    } else {
        $('#detail').html('<br/>Invalid plist.')
    }
   setupTypeahead();
}


function updatePlist() {
    if (js_obj != null) {
        editor.setValue(PlistParser.toPlist(js_obj, true));
        editor.selection.clearSelection();
        editor.selection.moveCursorToPosition({row: 0, column: 0});
        editor.selection.selectFileStart();
    }
}


function updatePlistAndBasics(data) {
    js_obj = data;
    showSaveOrCancelBtns();
    updatePlist();
    setupTypeahead();
}


function updatePlistAndDetail(data) {
    js_obj = data;
    showSaveOrCancelBtns();
    updatePlist();
    setupTypeahead();
}


function plistChanged() {
    showSaveOrCancelBtns();
    var val = editor.getValue();
    if (val) {
        try { js_obj = PlistParser.parse(val); }
        catch (e) { 
            //alert('Error in parsing plist. ' + e);
            js_obj = null;
        }
    } else {
        js_obj = {};
    }
}


var current_pathname = "";
var requested_pathname = "";
var editor = null;

function getPkginfoItem(pathname) {
    //event.preventDefault();
    if ($('#save_and_cancel').length && !$('#save_and_cancel').hasClass('hidden')) {
        /*if (! confirm('Discard current changes?')) {
            event.preventDefault();
            return;
        }*/
        requested_pathname = pathname;
        $("#saveOrCancelConfirmationModal").modal("show");
        event.preventDefault();
        return;
    }
    var pkginfoItemURL = '/pkgsinfo/' + pathname;
    $.ajax({
      type: 'GET',
      url: pkginfoItemURL,
      timeout: 10000,
      cache: false,
      success: function(data) {
          $('#pkginfo_item_detail').html(data);
          val = $('#plist').text();
          try { js_obj = PlistParser.parse(val); }
          catch (e) { 
                //alert('Error in parsing plist. ' + e);
                js_obj = null;
          }
          $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
              //e.target // newly activated tab
              //e.relatedTarget // previous active tab
              setupView(e.target.hash);
          })
          editor = initializeAceEditor('plist', plistChanged);
          hideSaveOrCancelBtns();
          detectUnsavedChanges();
          current_pathname = pathname;
          requested_pathname = "";
          $('#editortabs a[href="' + selected_tab_viewname + '"]').tab('show');
          setupView(selected_tab_viewname);
          do_resize();
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert("ERROR: " + textStatus + "\n" + errorThrown);
        $('#pkginfo_item_detail').html("")
        current_pathname = "";
      },
      dataType: 'html'
    });
}

function discardChangesAndLoadNext() {
    //$('#saveOrCancelConfirmationModal').modal('hide');
    $('.modal-backdrop').remove();
    hideSaveOrCancelBtns();
    getPkginfoItem(requested_pathname);
}


function saveChangesAndLoadNext() {
    savePkginfoItem();
    //$('#saveOrCancelConfirmationModal').modal('hide');
    $('.modal-backdrop').remove();
}


var js_obj = {};

var selected_tab_viewname = "#basicstab";

var key_list = {'name': 'Name', 
                'version': 'Version', 
                'display_name': 'Display name', 
                'description': 'Description', 
                'catalogs': 'Catalogs',
                'category': 'Category',
                'developer': 'Developer',
                'unattended_install': 'Unattended install',
                'unattended_uninstall': 'Unattended uninstall'};

var keys_and_types = {'apple_item': true,
                      'autoremove': true,
                      'blocking_applications': ['appname'],
                      'catalogs': [''],
                      'description': '',
                      'display_name': '',
                      'force_install_after_date': new Date(),
                      'icon_name': '',
                      'installable_condition': '',
                      'installed_size': 0,
                      'installer_choices_xml': '',
                      'installer_environment': {'USER': 'CURRENT_CONSOLE_USER'},
                      'installer_item_hash': '',
                      'installer_item_location': '',
                      'installer_type': '',
                      'installs': [{'type': 'file',
                                    'path': ''}],
                      'items_to_copy': [{'destination_path': '',
                                         'source_item': '',
                                         'user': 'root',
                                         'group': 'admin',
                                         'mode': 'o-w'}],
                      'minimum_munki_version': '2.3.0',
                      'minimum_os_version': '10.6.',
                      'maximum_os_version': '10.11',
                      'name': '',
                      'notes': '',
                      'OnDemand': true,
                      'PackageCompleteURL': '',
                      'PackageURL': '',
                      'package_path': '',
                      'installcheck_script': '',
                      'uninstallcheck_script': '',
                      'postinstall_script': '#!/bin/sh\nexit 0',
                      'postuninstall_script': '#!/bin/sh\nexit 0',
                      'preinstall_alert': {'alert_title': 'Preinstall Alert', 
                                           'alert_detail': 'Some important information',
                                           'ok_label': 'Install',
                                           'cancel_label': 'Cancel'},
                      'preuninstall_alert': {'alert_title': 'Preuninstall Alert', 
                                             'alert_detail': 'Some important information',
                                             'ok_label': 'Uninstall',
                                             'cancel_label': 'Cancel'},
                      'preupgrade_alert': {'alert_title': 'Preupgrade Alert', 
                                           'alert_detail': 'Some important information',
                                           'ok_label': 'Install',
                                           'cancel_label': 'Cancel'},
                      'preinstall_script': '#!/bin/sh\nexit 0',
                      'preuninstall_script': '#!/bin/sh\nexit 0',
                      'requires': ['itemname'],
                      'RestartAction': 'RequireRestart',
                      'supported_architectures': [''],
                      'unattended_install': true,
                      'unattended_uninstall': true,
                      'uninstall_method': '',
                      'uninstall_script': '',
                      'uninstaller_item_location': '',
                      'uninstallable': true,
                      'update_for': ['itemname'],
                      'version': '1.0'};


var validator = function(path, val) {
    var path_items = path.split('.');
    if (path_items.indexOf('requires') != -1 ||
        path_items.indexOf('update_for') != -1) {
            //check val against valid install items
            var valid_names = getValidInstallItems();
            if (valid_names.length && valid_names.indexOf(val) == -1) {
                return 'danger';
        }
    }
    return null;
};


function setupTypeahead() {
    // typeahead/autocomplete for pkginfo keys
    // suggest keys that are not already in use
    if (js_obj == null) return;
    var keys_in_use = Object.keys(js_obj),
        suggested_keys = Object.keys(keys_and_types),
        keys_to_suggest = suggested_keys.filter(function(value, index, arr){
            return (keys_in_use.indexOf(value) == -1)
        });
    $('div.plist-editor input.property').typeahead({source: keys_to_suggest});
    $('tr[data-path="catalogs"] textarea.value.form-control').typeahead({source: function(query, process) {
            return process($('#data_storage').data('catalog_names'));
        }
    });
    $('tr[data-path="requires"] textarea.value.form-control').typeahead({source: function(query, process) {
            return process(getValidInstallItems());
        }
    });
    $('tr[data-path="update_for"] textarea.value.form-control').typeahead({source: function(query, process) {
            return process(getValidInstallItems());
        }
    });
    $('tr[data-path="category"] textarea.value.form-control').typeahead({source: function(query, process) {
            return process(getCategories());
        }
    });
    $('tr[data-path="developer"] textarea.value.form-control').typeahead({source: function(query, process) {
            return process(getDevelopers());
        }
    });
}


function getCategories() {
    var data = $('#data_storage').data('catalog_data');
    if (data) {
        if (data.hasOwnProperty('_categories')) return data['_categories'];
    }
    return [];
}


function getDevelopers() {
    var data = $('#data_storage').data('catalog_data');
    if (data) {
        if (data.hasOwnProperty('_developers')) return data['_developers'];
    }
    return [];
}


function rebuildCatalogs() {
    $('#process_progress_title_text').text('Rebuilding catalogs...')
    $('#process_progress_status_text').text('Processing...')
    poll_loop = setInterval(function() {
            update_status('/makecatalogs/status');
        }, 1000);
    $.ajax({
      type: 'POST',
      url: '/makecatalogs/run',
      data: '',
      dataType: 'json',
      global: false,
      complete: function(jqXHR, textStatus){
          window.clearInterval(poll_loop);
          $('#process_progress').modal('hide');
        },
    });
}

function monitor_pkgsinfo_list() {
    $('#process_progress_title_text').text('Getting pkgsinfo data...')
    $('#process_progress_status_text').text('Processing...')
    poll_loop = setInterval(function() {
            update_status('/pkgsinfo/__get_process_status');
        }, 1000);
}


function savePkginfoItem() {
    $('.modal-backdrop').remove();
    //var plist_data = $('#plist').val();
    var plist_data = editor.getValue();
    var postdata = JSON.stringify({'plist_data': plist_data});
    var pkginfoItemURL = '/pkgsinfo/' + current_pathname;
    $.ajax({
      type: 'POST',
      url: pkginfoItemURL,
      data: postdata,
      timeout: 10000,
      success: function(data) {
        hideSaveOrCancelBtns();
        rebuildCatalogs();
        if (requested_pathname.length) {
            getPkginfoItem(requested_pathname);
        } else {
            // refresh our list
            $('#list_items').DataTable().ajax.reload();
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert("ERROR: " + textStatus + "\n" + errorThrown);
      },
      dataType: 'json'
    });
}


function deletePkginfoItem() {
    $('.modal-backdrop').remove();
    var pkginfoItemURL = '/pkgsinfo/' + current_pathname;
    var deletePkg = $('#delete_pkg').is(':checked');
    $.ajax({
      type: 'POST',
      url: pkginfoItemURL,
      data: JSON.stringify({'deletePkg': deletePkg}),
      headers: {'X_METHODOVERRIDE': 'DELETE'},
      success: function(data) {
          rebuildCatalogs();
          window.location.hash = '';
          $('#pkginfo_item_detail').html('');
          $('#list_items').DataTable().ajax.reload();
      },
      error: function(jqXHR, textStatus, errorThrown) {
        alert("ERROR: " + textStatus + "\n" + errorThrown);
      },
      dataType: 'json'
    });
}
