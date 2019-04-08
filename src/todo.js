export default class Todo {
    constructor() {
        this.useLocalStorage = this.checkLocalStorage();
        this.currentListIndex = 1;
        this.currentTaskIndex = 1;
        this.hasChanged = false;

        this.settings = {
            'currentWorkspace': 1,
            'version' : '1.0',
        };
        this.defaultWorkspace = {
                'id' : 1,
                'title' : 'Workspace 1',
                'lists' : [
                    this.listData(2, 'My first list', [
                        this.taskData('This is an active task!', false, null),
                        this.taskData('This is a completed task!', true, this.getCurrentDate())
                    ])
                ]
        };
        this.workspaces = [ this.copyObject(this.defaultWorkspace) ]; // Sensibile default in case loading fails
        this.workspaceIndex = 0; // Because lazy, but also performance
        this.workspace = null; // contains only the current workspace
        this.autoSave = null;

        // If using localstorage, see if we need to do setup
        if (this.useLocalStorage === true) {
            if (localStorage.getItem('workspaces') === null || localStorage.getItem('settings') === null) {
                this.workspaces = this.localStorageSetup();
                this.settings = JSON.parse(localStorage.getItem('settings'));

                // Once workspaces are loaded, populate workspace controls with the ability to switch
                this.updateWorkspaceDropdown();
            } else {
                this.workspaces = this.getWorkspaces();
                this.settings = this.getSettings();

                // Once workspaces are loaded, populate workspace controls with the ability to switch
                this.updateWorkspaceDropdown();
            }


            // Setup auto-save every 10 seconds
            this.autoSave = setInterval(function(_this, settings, workspaces) {
                if (_this.hasChanged) {
                    console.log("auto-saving...");
                    _this.setSettings();
                    _this.workspace.lists = _this.serializeLists();
                    _this.workspaces[_this.workspaceIndex] = _this.workspace;
                    _this.setWorkspaces();
                    _this.hasChanged = false;
                    console.log("Saving complete");
                }
            }, 10000, this, this.settings, this.workspaces);

            this.loadWorkspace(this.settings.currentWorkspace);
        }

        this.bindEvents();
    }

    bindEvents() {


        var _this = this;
        $("body").on("change", ".todo-item:checkbox", function() {
            _this.hasChanged = true;
            var dataAncestor = $(this).parent().parent().parent();
            if ($(this).is(':checked')) {
                $(this).parent().parent().parent().addClass('checked');
                $(this).parent().parent().find('.checkbox-label label').addClass('strikethrough');
                _this.completeTask(dataAncestor.attr('data-listid'), dataAncestor.attr('data-taskid'));
            } else {
                $(this).parent().parent().parent().removeClass('checked');
                $(this).parent().parent().find('.checkbox-label label').removeClass('strikethrough');
                _this.unCompleteTask(dataAncestor.attr('data-listid'), dataAncestor.attr('data-taskid'));
            }
        });

        $("body").on("keyup", '.todo-input', function(e) {
            if (!e) e = window.event;
            var key = e.keyCode || e.which;
            if (key == '13') {
                _this.hasChanged = true;
                _this.addTask($(this).attr('data-listid'), $(this).val());
                $(this).val('');
            }
        });

        $("body").on("click", ".task-delete", function() {
            _this.hasChanged = true;
            var listId = $(this).attr('data-listid');
            var taskId = $(this).attr('data-taskid');
            $(this).parent().parent().remove();
        });

        $("body").on("click", "#workspace-list-create", function() {
            _this.getListName();
        });

        $("body").on("click", "#workspaces-export", function() {
            // Create a combined object with settings and workspaces
            var data = {
                settings: _this.settings,
                workspaces: _this.workspaces
            };

            var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
            var dlAnchorElem = document.getElementById('export-element');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "todobackup.json");
            dlAnchorElem.click();
        });

        $("body").on("click", "#workspaces-import", function() {
            _this.getImportData();
        });

        $("body").on("click", ".list-filter-todo", function() {
            var listId = $(this).attr('data-listid');
            _this.applyTodoFilter(listId);
        });

        $("body").on("click", ".list-filter-completed", function() {
            var listId = $(this).attr('data-listid');
            _this.applyCompletedFilter(listId);
        });

        $("body").on("click", ".list-filter-all", function() {
            var listId = $(this).attr('data-listid');
            _this.removeFilters(listId);
        });

        $("body").on("change", "#workspace-selection", function() {
            // Save before making any changes
            console.log("Saving...");
            _this.setSettings();
            _this.workspace.lists = _this.serializeLists();
            _this.workspaces[_this.workspaceIndex] = _this.workspace;
            _this.setWorkspaces();
            _this.loadWorkspace($(this).val());
            _this.hasChanged = true;
        });

        $("body").on("click", "#workspace-create", function() {
           _this.getWorkspaceName();
        });

        $("body").on("click", ".list-rename", function() {
            _this.renameList($(this).attr('data-listid'));
        });

        $("body").on("click", ".list-clear", function() {
            _this.clearList($(this).attr('data-listid'));
        });

        $("body").on("click", ".list-delete", function() {
            _this.deleteList($(this).attr('data-listid'));
        });

        $("body").on("click", "#workspace-rename", function() {
            _this.renameWorkspace(_this.settings.currentWorkspace);
        });

        $("body").on("click", "#workspace-delete", function() {
            _this.deleteWorkspace(_this.settings.currentWorkspace);
        });


    }

    async getListName() {
        var _this = this;
        const {value: listName} = await Swal.fire({
            title: 'Enter New List Name',
            input: 'text',
            inputValidator: (value) => {
                if (value.length < 3) {
                    return 'List name must be at least three characters';
                }
            },
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonText: 'Create List',
            confirmButtonAriaLabel: 'Create List',
            cancelButtonAriaLabel: 'Cancel',
            cancelButtonText: 'Cancel',
            focusConfirm: false
        });

        if (listName) {
            _this.hasChanged = true;
            _this.addList(3, listName);
        }
    }

    async getWorkspaceName() {
        var _this = this;
        const {value: workspaceName} = await Swal.fire({
            title: 'Enter New Workspace Name',
            input: 'text',
            inputValidator: (value) => {
                if (value.length < 3) {
                    return 'Workspace name must be at least three characters';
                }
            },
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonText: 'Create Workspace',
            confirmButtonAriaLabel: 'Create Workspace',
            cancelButtonAriaLabel: 'Cancel',
            cancelButtonText: 'Cancel',
            focusConfirm: false
        });

        if (workspaceName) {
            _this.hasChanged = true;
            _this.createWorkspace(workspaceName);
        }
    }

    async renameList(listId) {
        var _this = this;
        const {value: listName} = await Swal.fire({
            title: 'Enter New List Name',
            input: 'text',
            inputValidator: (value) => {
                if (value.length < 3) {
                    return 'List name must be at least three characters';
                }
            },
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonText: 'Create List',
            confirmButtonAriaLabel: 'Create List',
            cancelButtonAriaLabel: 'Cancel',
            cancelButtonText: 'Cancel',
            focusConfirm: false
        });

        if (listName) {
            _this.hasChanged = true;

            // Rename in DOM
            $(".project-widget[data-listid='" + listId + "']>header>h2").text(listName);
        }
    }

    async renameWorkspace(workspaceId) {
        var _this = this;
        const {value: workspaceName} = await Swal.fire({
            title: 'Enter New Workspace Name',
            input: 'text',
            inputValidator: (value) => {
                if (value.length < 3) {
                    return 'Workspace name must be at least three characters';
                }
            },
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonText: 'Create Workspace',
            confirmButtonAriaLabel: 'Create Workspace',
            cancelButtonAriaLabel: 'Cancel',
            cancelButtonText: 'Cancel',
            focusConfirm: false
        });

        if (workspaceName) {
            _this.hasChanged = true;
            _this.workspace.title = workspaceName;
            _this.workspaces[_this.workspaceIndex] = _this.workspace;
            _this.updateWorkspaceDropdown();
        }
    }

    async getImportData() {
        const {value: text} = await Swal.fire({
            title: 'Importing Your Data',
            text: 'Please paste the contents of your exported todobackup.json file below and click "OK"',
            input: 'textarea',
            inputPlaceholder: 'Paste your backup here',
            showCancelButton: true
        })

        if (text) {
            var importedData = JSON.parse(text);
            // Make sure data structure has settings and workspace data
            if (!importedData.hasOwnProperty('settings') || !importedData.hasOwnProperty('workspaces')) {
                Swal.fire({
                    type: 'error',
                    title: 'Invalid Data',
                    text: 'Your backup does not appear to contain valid data or is formatted incorrectly. Please try again.',
                });
            } else {
                this.settings = importedData.settings;
                this.workspaces = importedData.workspaces;
                this.loadWorkspace(this.workspaces[0].id);
            }
        }
    }

    clearList(listId) {
        Swal.fire({
            title: 'Clear list?',
            text: "This action cannot be undone!",
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
        }).then((result) => {
            if (result.value) {
                _this.hasChanged = true;

                // Remove from DOM
                $(".todo-container[data-listid='"  + listId + "']").html('');
            }
        });
    }

    deleteList(listId) {
        Swal.fire({
            title: 'Delete list?',
            text: "This action cannot be undone!",
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
        }).then((result) => {
            if (result.value) {
                _this.hasChanged = true;

                // Remove from the DOM
                $(".project-widget[data-listid='" + listId + "']").parent().remove();
            }
        });
    }

    deleteWorkspace(workspaceId) {
        var _this = this;
        // Only allow user to delete workspace if it's not the only workspace
        if (this.workspaces.length > 1) {
            Swal.fire({
                title: 'Delete workspace?',
                text: "This action cannot be undone!",
                type: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
            }).then((result) => {
                if (result.value) {
                    _this.hasChanged = true;

                    for(var i = 0; i < _this.workspaces.length; i++) {
                        if (_this.workspaces[i].id == workspaceId) {
                            _this.workspaces.splice(i, 1);

                            // Once deleted, load the first available workspace
                            _this.loadWorkspace(_this.workspaces[0].id);
                            _this.updateWorkspaceDropdown();
                        }
                    }
                }
            });
        } else {
            Swal.fire({
                type: 'error',
                title: 'Unable to delete workspace',
                text: 'This is your only workspace. You must create a new workspace before deleting this one.',
            });
        }

    }

    checkLocalStorage() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
        } catch(e) {
            return false;
        }
    }

    localStorageSetup() {
        localStorage.setItem('settings', JSON.stringify(this.settings));
        localStorage.setItem('workspaces', JSON.stringify(this.workspaces));
        return JSON.parse(localStorage.getItem('workspaces'));
    }

    getSettings() {
        if (this.useLocalStorage) {
            return JSON.parse(localStorage.getItem('settings'));
        } else {
            return this.settings;
        }
    }

    setSettings() {
        if (this.useLocalStorage) {
            localStorage.setItem('settings', JSON.stringify(this.settings));
        }
    }

    getWorkspaces() {
        if (this.useLocalStorage) {
            return JSON.parse(localStorage.getItem('workspaces'));
        } else {
            return this.workspaces;
        }
    }

    setWorkspaces() {
        if (this.useLocalStorage) {
            localStorage.setItem('workspaces', JSON.stringify(this.workspaces));
        }
    }

    updateWorkspaceDropdown() {
        $("#workspace-selection option").remove();
        for (var i = 0; i < this.workspaces.length; i++) {
            if (this.workspaces[i].id == this.settings.currentWorkspace) {
                $("#workspace-selection").append('<option value="' + this.workspaces[i].id + '" selected>' + this.workspaces[i].title + '</option>');
            } else {
                $("#workspace-selection").append('<option value="' + this.workspaces[i].id + '">' + this.workspaces[i].title + '</option>');
            }
        }
    }

    loadWorkspace(workspaceId) {
        console.log("Loading workspace");
        this.settings.currentWorkspace = workspaceId;
        // Find the correct workspace
        for(var i = 0; i < this.workspaces.length; i++) {
            if (this.workspaces[i].id == workspaceId) {
                // Reset task and list indexes
                this.currentTaskIndex = 1;
                this.currentListIndex = 1;

                // Store for easier manipulation
                this.workspaceIndex = i;
                this.workspace = this.workspaces[i];

                // Empty all list containers
                $(".list-container").html('');

                // Load all lists for the workspace, but only display lists once they are whole
                for(var j = 0; j < this.workspace.lists.length; j++) {
                    var list = this.workspace.lists[j];
                    var tasksHtml = '';
                    this.currentListIndex++;

                    for(var k = 0; k < list.tasks.length; k++) {
                        var task = this.workspace.lists[j].tasks[k];
                        tasksHtml = tasksHtml.concat(this.taskHtml(j+1, k+1, task.text, task.checked, task.dateChecked));
                        this.currentTaskIndex++;
                    }

                    // Now we can add the list
                    $(".list-container[data-column=" + list.column + "]").append(this.listHtml(j+1, list.title, tasksHtml));
                }
            }
        }

        // Make each list sortable
        var groups = $(".list-group");

        for (var i = 0; i < $(groups).length; i++) {
            new Sortable($(groups)[i], {
                animation: 150,
                ghostClass: 'bg-info'
            });
        }

        // Make each list container a sortable and put them in a group
        var containers = $(".list-container");
        for (var i = 0; i < $(containers).length; i++) {
            new Sortable($(containers)[i], {
                animation: 150,
                ghostClass: 'bg-info',
                group: 'shared'
            });
        }

        console.log("Workspace loaded");
        this.updateWorkspaceDropdown();
        this.hasChanged = true;
    }

    addList(column, title) {
        $(".list-container[data-column=" + column + "]").append(this.listHtml(this.currentListIndex++, title));
    }

    addTask(listId, taskText) {
        $(".todo-container[data-listid=" + listId + "] .list-group")
            .append(this.taskHtml(listId, this.currentTaskIndex++, taskText, false, null));
    }

    // Applies to the current workspace
    applyTodoFilter(listId)
    {
        $(".list-group-item[data-listid='" + listId + "']:not(.checked)").show();
        $(".list-group-item[data-listid='" + listId + "'].checked").hide();
    }

    applyCompletedFilter(listId)
    {
        $(".list-group-item[data-listid='" + listId + "']:not(.checked)").hide();
        $(".list-group-item[data-listid='" + listId + "'].checked").show();
    }

    removeFilters(listId)
    {
        $(".list-group-item[data-listid='" + listId + "']:not(.checked)").show();
        $(".list-group-item[data-listid='" + listId + "'].checked").show();
    }

    createWorkspace(name)
    {
        console.log("Creating workspace with name " + name);

        // Create a copy of the default workspace and update the name and id
        var newWorkspace = this.copyObject(this.defaultWorkspace);
        newWorkspace.title = name;
        newWorkspace.id = this.workspaces.length + 1;

        // Save before making any changes
        console.log("Saving...");
        this.setSettings();
        this.workspace.lists = this.serializeLists();
        this.workspaces[this.workspaceIndex] = this.workspace;
        this.setWorkspaces();

        // Now push this new workspace onto the workspaces stack and load it
        this.workspaces.push(newWorkspace);
        this.loadWorkspace(newWorkspace.id);
        this.hasChanged = true;
    }



    listData(column, title, taskData) {
        // Include some default tasks if provided
        taskData = taskData || [];

        return {
            'column' : column,
            'theme' : 'default',
            'collapsed' : false,
            'sort-lock' : false,
            'filter' : 'all',
            'title' : title,
            'tasks' : taskData
        };
    }

    listHtml(listId, title, tasksHtml) {
        // Allow generation without providing a task list
        var tasksHtml = tasksHtml || '';

        return '<div class="row" style="margin-left: 0px; margin-right: 0px; margin-bottom: 30px;"><div class="project-widget" data-listid="' + listId + '">'+
            '<header role="heading">' +
                '<h2>' + title + '</h2>' +
                '<div class="widget-controls">' +
                    '<div class="dropdown widget-options">' +
                        '<span class="dropdown-toggle" data-toggle="dropdown"><i class="fa fa-cog fa-2x"></i></span>' +
                        '<ul class="dropdown-menu">' +
                            '<li><a class="list-filter-completed" href="#" data-listid="' + listId + '">View Completed</a></li>' +
                            '<li><a class="list-filter-todo" href="#" data-listid="' + listId + '">View Todo</a></li>' +
                            '<li><a class="list-filter-all" href="#" data-listid="' + listId + '">View All</a></li>' +
                            '<li role="separator" class="divider"></li>' +
                            '<li><a class="list-rename" href="#" data-listid="' + listId + '">Rename List</a></li>' +
                            '<li><a class="list-clear" href="#" data-listid="' + listId + '">Delete All Items</a></li>' +
                            '<li><a class="list-delete" href="#" data-listid="' + listId + '">Delete List</a></li>' +

                        '</ul>' +
                    '</div>' +
                '</div>' +
            '</header>' +
            '<div role="content">' +
                '<div class="widget-content no-padding">' +
                    '<div class="form-group full-width">' +
                        '<input type="text" class="form-control todo-input" placeholder="Add New Task" data-listid="' + listId + '">' +
                    '</div>' +
                    '<div class="todo-container" data-listid="' + listId + '">' +
                        '<ul class="list-group">' + tasksHtml +
                        '</ul>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div></div>';
    }

    taskData(taskText, checked, dateChecked) {
        return {
            'text' : taskText,
            'checked' : checked,
            'dateChecked': dateChecked
        };
    }

    taskHtml(listId, taskId, taskText, checked, dateChecked) {
        if (checked == true) {
            checked = 'checked';
            var strikethrough = 'strikethrough';
        } else {
            checked = '';
            var strikethrough = '';
            dateChecked = '';
        }

        return '<li class="todo-draggable list-group-item ' + checked + '" data-listid="' + listId +'" data-taskid="' + taskId + '">' +
                '<div class="task-action">' +
                    '<btn class="task-delete" data-listid="' + listId + '" data-taskid="' + taskId + '"><i class="fa fa-times"></i></btn>' +
                '</div>' +
                '<div class="checkbox-wrapper">' +
                    '<div class="checkbox">' +
                        '<input type="checkbox" class="todo-item" ' + checked + '>' +
                    '</div>' +
                    '<div class="checkbox-label">' +
                        '<label class="' + strikethrough + '">' + taskText + '</label>' +
                    '</div>' +
                    '<div class="task-date">' + dateChecked + '</div>' +
                '</div>' +
            '</li>';
    }

    getCurrentDate() {
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth() + 1; //January is 0!

        var yyyy = today.getFullYear();
        if (dd < 10) {
            dd = '0' + dd;
        }
        if (mm < 10) {
            mm = '0' + mm;
        }
        return mm + '/' + dd + '/' + yyyy;
    }

    // Defaults to the current workspace
    completeTask(listId, taskId) {
        $(".list-group-item[data-listid=" + listId + "][data-taskId=" + taskId + "]").find('.task-date').text(this.getCurrentDate());
    }

    unCompleteTask(listId, taskId) {
        $(".list-group-item[data-listid=" + listId + "][data-taskId=" + taskId + "]").find('.task-date').text('');
    }

    serializeLists() {
        var lists = [];
        var listPosition = 1;

        // Loop through each column
        for (var i = 1; i <= 3; i++) {
            $(".list-container[data-column='" + i + "'] .project-widget").each(function(listIndex, listElem) {
                var newList = {
                    'column': i,
                    'theme': 'default',
                    'collapsed': false,
                    'sort-lock': false,
                    'title': $(listElem).find('header>h2').text(),
                    'tasks': []
                };

                // Loop through all tasks
                $(listElem).find(".todo-container>.list-group>.list-group-item").each(function(taskIndex,taskElem) {
                    newList.tasks.push({
                        'text': $(taskElem).find(".checkbox-label").text(),
                        'checked': $(taskElem).find("input[type='checkbox']").prop('checked'),
                        'dateChecked': ($(taskElem).find('.task-date').text().length > 0 ? $(taskElem).find('.task-date').text() : null)
                    });
                });
                lists.push(newList);
            });
        }

        return lists;
    }

    // Returns a deep copy of an object that isn't a reference
    copyObject(input) {
        return JSON.parse(JSON.stringify(input));
    }
}