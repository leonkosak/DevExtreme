var $ = require("../../core/renderer"),
    modules = require("./ui.grid_core.modules"),
    gridCoreUtils = require("./ui.grid_core.utils"),
    ArrayStore = require("../../data/array_store"),
    CustomStore = require("../../data/custom_store"),
    errors = require("../widget/ui.errors"),
    commonUtils = require("../../core/utils/common"),
    each = require("../../core/utils/iterator").each,
    typeUtils = require("../../core/utils/type"),
    extend = require("../../core/utils/extend").extend,
    DataHelperMixin = require("../../data_helper"),
    equalKeys = commonUtils.equalByValue,
    deferredUtils = require("../../core/utils/deferred"),
    when = deferredUtils.when,
    Deferred = deferredUtils.Deferred;

module.exports = {
    defaultOptions: function() {
        return {
            loadingTimeout: 0,
            /**
             * @name GridBaseOptions.dataSource
             * @type string|Array<Object>|DataSource|DataSourceOptions
             * @default null
             */
            dataSource: null,
            /**
             * @name GridBaseOptions.cacheEnabled
             * @type boolean
             * @default true
             */
            cacheEnabled: true,
            /**
             * @name GridBaseOptions.onDataErrorOccurred
             * @extends Action
             * @type function(e)
             * @type_function_param1 e:object
             * @type_function_param1_field4 error:Error
             * @action
            */
            onDataErrorOccurred: null,
            /**
             * @name dxDataGridOptions.remoteOperations
             * @type boolean|object
             */
            /**
             * @name dxTreeListOptions.remoteOperations
             * @type object
             */
            remoteOperations: "auto",
            /**
             * @name dxDataGridOptions.remoteOperations.sorting
             * @type boolean
             * @default false
             */
            /**
             * @name dxDataGridOptions.remoteOperations.filtering
             * @type boolean
             * @default false
             */
            /**
             * @name dxDataGridOptions.remoteOperations.paging
             * @type boolean
             * @default false
             */
            /**
             * @name dxDataGridOptions.remoteOperations.grouping
             * @type boolean
             * @default false
             */
            /**
             * @name dxDataGridOptions.remoteOperations.groupPaging
             * @type boolean
             * @default false
             */
            /**
             * @name dxDataGridOptions.remoteOperations.summary
             * @type boolean
             * @default false
             */
            /**
             * @name dxTreeListOptions.remoteOperations.sorting
             * @type boolean
             * @default false
             */
            /**
             * @name dxTreeListOptions.remoteOperations.filtering
             * @type boolean
             * @default false
             */
            /**
             * @name dxTreeListOptions.remoteOperations.grouping
             * @type boolean
             * @default false
             */
            /**
             * @name GridBaseOptions.paging
             * @type object
             */
            paging: {
                /**
                 * @name GridBaseOptions.paging.enabled
                 * @type boolean
                 * @default true
                 */
                enabled: true,
                /**
                 * @name GridBaseOptions.paging.pageSize
                 * @type number
                 * @default 20
                 * @fires GridBaseOptions.onOptionChanged
                 */
                pageSize: undefined,
                /**
                 * @name GridBaseOptions.paging.pageIndex
                 * @type number
                 * @default 0
                 * @fires GridBaseOptions.onOptionChanged
                 */
                pageIndex: undefined
            }
            /**
             * @name GridBaseOptions.onRowExpanding
             * @type function(e)
             * @type_function_param1 e:object
             * @type_function_param1_field4 key:any
             * @type_function_param1_field5 cancel:boolean
             * @extends Action
             * @action
             */
            /**
             * @name GridBaseOptions.onRowExpanded
             * @type function(e)
             * @type_function_param1 e:object
             * @type_function_param1_field4 key:any
             * @extends Action
             * @action
             */
            /**
             * @name GridBaseOptions.onRowCollapsing
             * @type function(e)
             * @type_function_param1 e:object
             * @type_function_param1_field4 key:any
             * @type_function_param1_field5 cancel:boolean
             * @extends Action
             * @action
             */
            /**
             * @name GridBaseOptions.onRowCollapsed
             * @type function(e)
             * @type_function_param1 e:object
             * @type_function_param1_field4 key:any
             * @extends Action
             * @action
             */
        };
    },
    controllers: {
        data: modules.Controller.inherit({}).include(DataHelperMixin).inherit((function() {
            var changePaging = function(that, optionName, value) {
                var dataSource = that._dataSource;

                if(dataSource) {
                    if(value !== undefined) {
                        if(dataSource[optionName]() !== value) {
                            if(optionName === "pageSize") {
                                dataSource.pageIndex(0);
                            }
                            dataSource[optionName](value);

                            that._skipProcessingPagingChange = true;
                            that.option("paging." + optionName, value);
                            that._skipProcessingPagingChange = false;

                            return dataSource[optionName === "pageIndex" ? "load" : "reload"]()
                                .done(that.pageChanged.fire.bind(that.pageChanged));
                        }
                        return Deferred().resolve().promise();
                    }
                    return dataSource[optionName]();
                }

                return 0;
            };

            var members = {
                init: function() {
                    var that = this;
                    that._items = [];
                    that._columnsController = that.getController("columns");

                    that._columnsChangedHandler = that._handleColumnsChanged.bind(that);
                    that._dataChangedHandler = that._handleDataChanged.bind(that);
                    that._loadingChangedHandler = that._handleLoadingChanged.bind(that);
                    that._loadErrorHandler = that._handleLoadError.bind(that);
                    that._customizeStoreLoadOptionsHandler = that._handleCustomizeStoreLoadOptions.bind(that);

                    that._columnsController.columnsChanged.add(that._columnsChangedHandler);

                    that._isLoading = false;
                    that._isCustomLoading = false;
                    that._changes = [];

                    that.createAction("onDataErrorOccurred");

                    that.dataErrorOccurred.add(function(error) {
                        return that.executeAction("onDataErrorOccurred", { error: error });
                    });

                    that._refreshDataSource();
                },
                callbackNames: function() {
                    return ["changed", "loadingChanged", "dataErrorOccurred", "pageChanged", "dataSourceChanged"];
                },
                callbackFlags: function(name) {
                    if(name === "dataErrorOccurred") {
                        return { stopOnFalse: true };
                    }
                },
                publicMethods: function() {
                    return [
                        "beginCustomLoading",
                        "endCustomLoading",
                        "refresh",
                        "filter",
                        "clearFilter",
                        "getCombinedFilter",
                        "keyOf",
                        "byKey",
                        "getDataByKeys",
                        "pageIndex",
                        "pageSize",
                        "pageCount",
                        "totalCount",
                        "_disposeDataSource",
                        "getKeyByRowIndex",
                        "getRowIndexByKey",
                        "getDataSource",
                        "getVisibleRows",
                        "repaintRows"
                    ];
                },
                optionChanged: function(args) {
                    var that = this;

                    function handled() {
                        args.handled = true;
                    }

                    function reload() {
                        that._columnsController.reset();
                        that._items = [];
                        that._refreshDataSource();
                    }

                    if(args.name === "dataSource" && args.name === args.fullName && args.value === args.previousValue) {
                        handled();
                        that.refresh();
                        return;
                    }

                    switch(args.name) {
                        case "cacheEnabled":
                        case "loadingTimeout":
                        case "remoteOperations":
                            handled();
                            break;
                        case "keyExpr":
                        case "dataSource":
                        case "scrolling":
                        case "paging":
                            handled();
                            if(!that.skipProcessingPagingChange(args.fullName)) {
                                reload();
                            }
                            break;
                        case "rtlEnabled":
                            reload();
                            break;
                        default:
                            that.callBase(args);
                    }
                },
                isReady: function() {
                    return !this._isLoading;
                },

                getDataSource: function() {
                    return this._dataSource && this._dataSource._dataSource;
                },
                /**
                 * @name GridBaseMethods.getCombinedFilter
                 * @publicName getCombinedFilter()
                 * @return any
                 */
                /**
                 * @name GridBaseMethods.getCombinedFilter
                 * @publicName getCombinedFilter(returnDataField)
                 * @param1 returnDataField:boolean
                 * @return any
                 */
                getCombinedFilter: function(returnDataField) {
                    return this.combinedFilter(undefined, returnDataField);
                },
                combinedFilter: function(filter, returnDataField) {
                    var that = this,
                        dataSource = that._dataSource,
                        columnsController = that._columnsController,
                        additionalFilter;

                    if(dataSource) {
                        if(filter === undefined) {
                            filter = dataSource.filter();
                        }

                        additionalFilter = that._calculateAdditionalFilter();
                        if(additionalFilter) {
                            if(columnsController.isDataSourceApplied() || columnsController.isAllDataTypesDefined()) {
                                filter = gridCoreUtils.combineFilters([additionalFilter, filter]);
                            }
                        }

                        filter = columnsController.updateFilter(filter, returnDataField || dataSource.remoteOperations().filtering);
                    }
                    return filter;
                },
                _endUpdateCore: function() {
                    var changes = this._changes;

                    if(changes.length) {
                        this._changes = [];
                        this.updateItems(changes.length === 1 ? changes[0] : {});
                    }
                },
                // Handlers
                _handleCustomizeStoreLoadOptions: function(e) {
                    var columnsController = this._columnsController,
                        dataSource = this._dataSource,
                        storeLoadOptions = e.storeLoadOptions;

                    if(e.isCustomLoading && !storeLoadOptions.isLoadingAll) {
                        return;
                    }

                    storeLoadOptions.filter = this.combinedFilter(storeLoadOptions.filter);

                    if(!columnsController.isDataSourceApplied()) {
                        columnsController.updateColumnDataTypes(dataSource);
                    }
                    this._columnsUpdating = true;
                    columnsController.updateSortingGrouping(dataSource, !this._isFirstLoading);
                    this._columnsUpdating = false;

                    storeLoadOptions.sort = columnsController.getSortDataSourceParameters();
                    storeLoadOptions.group = columnsController.getGroupDataSourceParameters();
                    dataSource.sort(storeLoadOptions.sort);
                    dataSource.group(storeLoadOptions.group);

                    storeLoadOptions.sort = columnsController.getSortDataSourceParameters(!dataSource.remoteOperations().sorting);

                    e.group = columnsController.getGroupDataSourceParameters(!dataSource.remoteOperations().grouping);
                    this._isFirstLoading = false;

                },
                _handleColumnsChanged: function(e) {
                    var that = this,
                        changeTypes = e.changeTypes,
                        optionNames = e.optionNames,
                        filterValue,
                        filterValues,
                        filterApplied;

                    // B255430
                    var updateItemsHandler = function() {
                        that._columnsController.columnsChanged.remove(updateItemsHandler);
                        that.updateItems();
                    };

                    if(changeTypes.sorting || changeTypes.grouping) {
                        if(that._dataSource && !that._columnsUpdating) {
                            that._dataSource.group(that._columnsController.getGroupDataSourceParameters());
                            that._dataSource.sort(that._columnsController.getSortDataSourceParameters());
                            that.reload();
                        }
                    } else if(changeTypes.columns) {
                        if(optionNames.filterValues || optionNames.filterValue || optionNames.selectedFilterOperation) {
                            filterValue = that._columnsController.columnOption(e.columnIndex, "filterValue");
                            filterValues = that._columnsController.columnOption(e.columnIndex, "filterValues");

                            if(Array.isArray(filterValues) || e.columnIndex === undefined || typeUtils.isDefined(filterValue) || !optionNames.selectedFilterOperation || optionNames.filterValue) {
                                that._applyFilter();
                                filterApplied = true;
                            }
                        }

                        if(!that._needApplyFilter && !gridCoreUtils.checkChanges(optionNames, ["width", "visibleWidth", "filterValue", "bufferedFilterValue", "selectedFilterOperation", "filterValues", "filterType"])) {
                            // TODO remove resubscribing
                            that._columnsController.columnsChanged.add(updateItemsHandler);
                        }

                        if(typeUtils.isDefined(optionNames.visible)) {
                            var column = that._columnsController.columnOption(e.columnIndex);
                            if(column && (typeUtils.isDefined(column.filterValue) || typeUtils.isDefined(column.filterValues))) {
                                that._applyFilter();
                                filterApplied = true;
                            }
                        }
                    }
                    if(!filterApplied && changeTypes.filtering) {
                        that.reload();
                    }
                },
                _handleDataChanged: function(e) {
                    var that = this,
                        dataSource = that._dataSource,
                        columnsController = that._columnsController,
                        isAsyncDataSourceApplying = false;

                    if(dataSource && !that._isDataSourceApplying) {
                        that._isDataSourceApplying = true;

                        when(that._columnsController.applyDataSource(dataSource)).done(function() {
                            if(that._isLoading) {
                                that._handleLoadingChanged(false);
                            }

                            if(isAsyncDataSourceApplying && e && e.isDelayed) {
                                e.isDelayed = false;
                            }

                            that._isDataSourceApplying = false;

                            var additionalFilter = that._calculateAdditionalFilter(),
                                needApplyFilter = that._needApplyFilter;

                            that._needApplyFilter = false;

                            if(needApplyFilter && additionalFilter && additionalFilter.length && !that._isAllDataTypesDefined) {
                                errors.log("W1005", that.component.NAME);
                                that._applyFilter();
                            } else {
                                that.updateItems(e);
                            }
                        }).fail(function() {
                            that._isDataSourceApplying = false;
                        });
                        if(that._isDataSourceApplying) {
                            isAsyncDataSourceApplying = true;
                            that._handleLoadingChanged(true);
                        }

                        that._needApplyFilter = !that._columnsController.isDataSourceApplied();
                        that._isAllDataTypesDefined = columnsController.isAllDataTypesDefined();
                    }
                },
                _handleLoadingChanged: function(isLoading) {
                    this._isLoading = isLoading;
                    this._fireLoadingChanged();
                },
                _handleLoadError: function(e) {
                    this.dataErrorOccurred.fire(e);
                },
                _setPagingOptions: function(dataSource) {
                    var pageIndex = this.option("paging.pageIndex"),
                        pageSize = this.option("paging.pageSize"),
                        pagingEnabled = this.option("paging.enabled"),
                        scrollingMode = this.option("scrolling.mode"),
                        appendMode = scrollingMode === "infinite",
                        virtualMode = scrollingMode === "virtual";

                    dataSource.requireTotalCount(!appendMode);
                    if(pagingEnabled !== undefined) {
                        dataSource.paginate(pagingEnabled || virtualMode || appendMode);
                    }
                    if(pageSize !== undefined) {
                        dataSource.pageSize(pageSize);
                    }
                    if(pageIndex !== undefined) {
                        dataSource.pageIndex(pageIndex);
                    }
                },
                _getSpecificDataSourceOption: function() {
                    var dataSource = this.option("dataSource");

                    if(Array.isArray(dataSource)) {
                        return {
                            store: {
                                type: "array",
                                data: dataSource,
                                key: this.option("keyExpr")
                            }
                        };
                    }

                    return dataSource;
                },
                _initDataSource: function() {
                    var that = this,
                        dataSource = this.option("dataSource"),
                        oldDataSource = this._dataSource;

                    that.callBase();
                    dataSource = that._dataSource;
                    that._isFirstLoading = true;
                    if(dataSource) {
                        that._setPagingOptions(dataSource);
                        that.setDataSource(dataSource);
                    } else if(oldDataSource) {
                        that.updateItems();
                    }
                },
                _loadDataSource: function() {
                    var dataSource = this._dataSource,
                        result = new Deferred();

                    when(this._columnsController.refresh(true)).always(function() {
                        if(dataSource) {
                            dataSource.load().done(result.resolve).fail(result.reject);
                        } else {
                            result.resolve();
                        }
                    });

                    return result.promise();
                },
                _beforeProcessItems: function(items) {
                    return items.slice(0);
                },
                getRowIndexDelta: function() {
                    return 0;
                },
                _processItems: function(items, changeType) {
                    var that = this,
                        rowIndexDelta = that.getRowIndexDelta(),
                        visibleColumns = that._columnsController.getVisibleColumns(null, changeType === "loadingAll"),
                        visibleItems = that._items,
                        dataIndex = changeType === "append" && visibleItems.length > 0 ? visibleItems[visibleItems.length - 1].dataIndex + 1 : 0,
                        options = {
                            visibleColumns: visibleColumns,
                            dataIndex: dataIndex
                        },
                        result = [];

                    each(items, function(index, item) {
                        if(typeUtils.isDefined(item)) {
                            options.rowIndex = index - rowIndexDelta;
                            item = that._processItem(item, options);
                            result.push(item);
                        }
                    });
                    return result;
                },
                _processItem: function(item, options) {
                    item = this._generateDataItem(item);
                    item = this._processDataItem(item, options);
                    item.dataIndex = options.dataIndex++;
                    return item;
                },
                _generateDataItem: function(data) {
                    return {
                        rowType: "data",
                        data: data,
                        key: this.keyOf(data)
                    };
                },
                _processDataItem: function(dataItem, options) {
                    dataItem.values = this.generateDataValues(dataItem.data, options.visibleColumns);
                    return dataItem;
                },
                generateDataValues: function(data, columns) {
                    var values = [],
                        column,
                        value;

                    for(var i = 0; i < columns.length; i++) {
                        column = columns[i];
                        value = null;
                        if(column.command) {
                            value = null;
                        } else if(column.calculateCellValue) {
                            value = column.calculateCellValue(data);
                        } else if(column.dataField) {
                            value = data[column.dataField];
                        }
                        values.push(value);

                    }
                    return values;
                },
                _applyChangeUpdate: function(change) {
                    var that = this,
                        items = change.items,
                        rowIndices = change.rowIndices.slice(0),
                        rowIndexDelta = that.getRowIndexDelta(),
                        prevIndex = -1,
                        rowIndexCorrection = 0,
                        changeType;

                    rowIndices.sort(function(a, b) { return a - b; });

                    for(var i = 0; i < rowIndices.length; i++) {
                        if(rowIndices[i] < 0) {
                            rowIndices.splice(i, 1);
                            i--;
                        }
                    }

                    change.items = [];
                    change.rowIndices = [];
                    change.changeTypes = [];

                    var equalItems = function(item1, item2, strict) {
                        var result = item1 && item2 && equalKeys(item1.key, item2.key);
                        if(result && strict) {
                            result = item1.rowType === item2.rowType && (item2.rowType !== "detail" || item1.isEditing === item2.isEditing);
                        }
                        return result;
                    };

                    each(rowIndices, function(index, rowIndex) {
                        var oldItem,
                            newItem,
                            oldNextItem,
                            newNextItem,
                            strict;

                        rowIndex += rowIndexCorrection + rowIndexDelta;

                        if(prevIndex === rowIndex) return;

                        prevIndex = rowIndex;
                        oldItem = that._items[rowIndex];
                        oldNextItem = that._items[rowIndex + 1];
                        newItem = items[rowIndex];
                        newNextItem = items[rowIndex + 1];

                        strict = equalItems(oldItem, oldNextItem) || equalItems(newItem, newNextItem);

                        if(newItem) {
                            change.items.push(newItem);
                        }

                        if(oldItem && newItem && equalItems(oldItem, newItem, strict)) {
                            changeType = "update";
                            that._items[rowIndex] = newItem;
                            if(oldItem.visible !== newItem.visible) {
                                change.items.splice(-1, 1, { visible: newItem.visible });
                            }
                        } else if(newItem && !oldItem || (newNextItem && equalItems(oldItem, newNextItem, strict))) {
                            changeType = "insert";
                            that._items.splice(rowIndex, 0, newItem);
                            rowIndexCorrection++;
                        } else if(oldItem && !newItem || (oldNextItem && equalItems(newItem, oldNextItem, strict))) {
                            changeType = "remove";
                            that._items.splice(rowIndex, 1);
                            rowIndexCorrection--;
                            prevIndex = -1;
                        } else if(newItem) {
                            changeType = "update";
                            that._items[rowIndex] = newItem;
                        } else {
                            return;
                        }

                        change.rowIndices.push(rowIndex - rowIndexDelta);
                        change.changeTypes.push(changeType);
                    });
                },
                _applyChange: function(change) {
                    var that = this;

                    if(change.changeType === "update") {
                        that._applyChangeUpdate(change);
                    } else {
                        that._items = change.items.slice(0);
                    }
                },
                _updateItemsCore: function(change) {
                    var that = this,
                        items,
                        dataSource = that._dataSource,
                        changeType = change.changeType || "refresh";

                    change.changeType = changeType;

                    if(dataSource) {
                        items = change.items || dataSource.items();
                        items = that._beforeProcessItems(items);
                        items = that._processItems(items, changeType);

                        change.items = items;

                        that._applyChange(change);

                        each(that._items, function(index, item) {
                            item.rowIndex = index;
                        });
                    } else {
                        that._items = [];
                    }
                },
                updateItems: function(change) {
                    change = change || {};
                    var that = this;

                    if(that._updateLockCount) {
                        that._changes.push(change);
                        return;
                    }

                    that._updateItemsCore(change);

                    if(change.cancel) return;

                    that._fireChanged(change);
                },
                _fireChanged: function(change) {
                    var that = this;
                    commonUtils.deferRender(function() {
                        that.changed.fire(change);
                    });
                },
                isLoading: function() {
                    return this._isLoading || this._isCustomLoading;
                },
                _fireLoadingChanged: function() {
                    this.loadingChanged.fire(this.isLoading(), this._loadingText);
                },
                _calculateAdditionalFilter: function() {
                    return null;
                },
                _applyFilter: function() {
                    var that = this,
                        dataSource = that._dataSource;

                    if(dataSource) {
                        dataSource.pageIndex(0);

                        return that.reload().done(that.pageChanged.fire.bind(that.pageChanged));
                    }
                },
                /**
                 * @name GridBaseMethods.filter
                 * @publicName filter(filterExpr)
                 * @param1 filterExpr:any
                 */
                /**
                 * @name GridBaseMethods.filter
                 * @publicName filter()
                 * @return any
                 */
                filter: function(filterExpr) {
                    var dataSource = this._dataSource,
                        filter = dataSource.filter();

                    if(arguments.length === 0) {
                        return dataSource ? dataSource.filter() : undefined;
                    }

                    filterExpr = arguments.length > 1 ? Array.prototype.slice.call(arguments, 0) : filterExpr;

                    if(gridCoreUtils.equalFilterParameters(filter, filterExpr)) {
                        return;
                    }
                    if(dataSource) {
                        dataSource.filter(filterExpr);
                    }
                    this._applyFilter();
                },
                /**
                * @name GridBaseMethods.clearFilter
                * @publicName clearFilter()
                */
                /**
                 * @name GridBaseMethods.clearFilter
                 * @publicName clearFilter(filterName)
                 * @param1 filterName:string
                 */
                clearFilter: function(filterName) {
                    var that = this,
                        columnsController = that._columnsController,
                        clearColumnOption = function(optionName) {
                            var columnCount = columnsController.columnCount(),
                                index;

                            for(index = 0; index < columnCount; index++) {
                                columnsController.columnOption(index, optionName, undefined);
                            }
                        };

                    that.component.beginUpdate();

                    if(arguments.length > 0) {
                        switch(filterName) {
                            case "dataSource":
                                that.filter(null);
                                break;
                            case "search":
                                that.searchByText("");
                                break;
                            case "header":
                                clearColumnOption("filterValues");
                                break;
                            case "row":
                                clearColumnOption("filterValue");
                                break;
                        }
                    } else {
                        that.filter(null);
                        that.searchByText("");
                        clearColumnOption("filterValue");
                        clearColumnOption("filterValues");
                    }

                    that.component.endUpdate();
                },
                _fireDataSourceChanged: function() {
                    var that = this;

                    var changedHandler = function() {
                        that.changed.remove(changedHandler);
                        that.dataSourceChanged.fire();
                    };

                    that.changed.add(changedHandler);
                },
                _getDataSourceAdapter: commonUtils.noop,
                _createDataSourceAdapterCore: function(dataSource, remoteOperations) {
                    var dataSourceAdapterProvider = this._getDataSourceAdapter(),
                        dataSourceAdapter = dataSourceAdapterProvider.create(this.component);

                    dataSourceAdapter.init(dataSource, remoteOperations);
                    return dataSourceAdapter;
                },
                isLocalStore: function(store) {
                    store = store || this.store();
                    return store instanceof ArrayStore;
                },
                isCustomStore: function(store) {
                    store = store || this.store();
                    return store instanceof CustomStore;
                },
                _createDataSourceAdapter: function(dataSource) {
                    var remoteOperations = this.option("remoteOperations"),
                        store = dataSource.store(),
                        enabledRemoteOperations = { filtering: true, sorting: true, paging: true, grouping: true, summary: true };

                    if(remoteOperations && remoteOperations.groupPaging) {
                        remoteOperations = extend({}, enabledRemoteOperations, remoteOperations);
                    }

                    if(remoteOperations === "auto") {
                        remoteOperations = this.isLocalStore(store) || this.isCustomStore(store) ? {} : { filtering: true, sorting: true, paging: true };
                    }
                    if(remoteOperations === true) {
                        remoteOperations = enabledRemoteOperations;
                    }

                    return this._createDataSourceAdapterCore(dataSource, remoteOperations);
                },
                setDataSource: function(dataSource) {
                    var that = this,
                        oldDataSource = that._dataSource;

                    if(!dataSource && oldDataSource) {
                        oldDataSource.changed.remove(that._dataChangedHandler);
                        oldDataSource.loadingChanged.remove(that._loadingChangedHandler);
                        oldDataSource.loadError.remove(that._loadErrorHandler);
                        oldDataSource.customizeStoreLoadOptions.remove(that._customizeStoreLoadOptionsHandler);
                        oldDataSource.dispose(that._isSharedDataSource);
                    }

                    if(dataSource) {
                        dataSource = that._createDataSourceAdapter(dataSource);
                    }

                    that._dataSource = dataSource;

                    if(dataSource) {
                        that._fireDataSourceChanged();
                        that._isLoading = !dataSource.isLoaded();
                        that._needApplyFilter = true;
                        that._isAllDataTypesDefined = that._columnsController.isAllDataTypesDefined();
                        dataSource.changed.add(that._dataChangedHandler);
                        dataSource.loadingChanged.add(that._loadingChangedHandler);
                        dataSource.loadError.add(that._loadErrorHandler);
                        dataSource.customizeStoreLoadOptions.add(that._customizeStoreLoadOptionsHandler);
                    }
                },
                items: function() {
                    return this._items;
                },
                isEmpty: function() {
                    return !this.items().length;
                },
                /**
                 * @name GridBaseMethods.pageCount
                 * @publicName pageCount()
                 * @return numeric
                 */
                pageCount: function() {
                    return this._dataSource ? this._dataSource.pageCount() : 1;
                },
                dataSource: function() {
                    return this._dataSource;
                },
                store: function() {
                    var dataSource = this._dataSource;
                    return dataSource && dataSource.store();
                },
                loadAll: function(data) {
                    var that = this,
                        d = new Deferred(),
                        dataSource = that._dataSource;

                    if(dataSource) {
                        if(data) {
                            var options = {
                                data: data,
                                isCustomLoading: true,
                                storeLoadOptions: {},
                                loadOptions: {
                                    filter: that.getCombinedFilter(),
                                    group: dataSource.group(),
                                    sort: dataSource.sort()
                                }
                            };
                            dataSource._handleDataLoaded(options);
                            when(options.data).done(function(data) {
                                data = that._beforeProcessItems(data);
                                d.resolve(that._processItems(data, "loadingAll"), options.extra && options.extra.summary);
                            }).fail(d.reject);
                        } else {
                            if(!that.isLoading()) {
                                var loadOptions = extend({}, dataSource.loadOptions(), { isLoadingAll: true, requireTotalCount: false });
                                dataSource.load(loadOptions).done(function(items, extra) {
                                    items = that._beforeProcessItems(items);
                                    items = that._processItems(items, "loadingAll");
                                    d.resolve(items, extra && extra.summary);
                                }).fail(d.reject);
                            } else {
                                d.reject();
                            }
                        }
                    } else {
                        d.resolve([]);
                    }
                    return d;
                },
                /**
                * @name GridBaseMethods.getKeyByRowIndex
                * @publicName getKeyByRowIndex(rowIndex)
                * @param1 rowIndex:numeric
                * @return any
                */
                getKeyByRowIndex: function(rowIndex) {
                    var item = this.items()[rowIndex];
                    if(item) {
                        return item.key;
                    }
                },
                /**
                * @name GridBaseMethods.getRowIndexByKey
                * @publicName getRowIndexByKey(key)
                * @param1 key:object|string|number
                * @return numeric
                */
                getRowIndexByKey: function(key) {
                    return gridCoreUtils.getIndexByKey(key, this.items());
                },
                /**
                * @name GridBaseMethods.keyOf
                * @publicName keyOf(obj)
                * @param1 obj:object
                * @return any
                */
                keyOf: function(data) {
                    var store = this.store();
                    if(store) {
                        return store.keyOf(data);
                    }
                },
                /**
                * @name GridBaseMethods.byKey
                * @publicName byKey(key)
                * @param1 key:object|string|number
                * @return Promise<Object>
                */
                byKey: function(key) {
                    var store = this.store(),
                        rowIndex = this.getRowIndexByKey(key),
                        result;

                    if(!store) return;

                    if(rowIndex >= 0) {
                        result = new Deferred().resolve(this.items()[rowIndex].data);
                    }

                    return result || store.byKey(key);
                },
                key: function() {
                    var store = this.store();

                    if(store) {
                        return store.key();
                    }
                },
                getRowIndexOffset: function() {
                    return 0;
                },
                getDataByKeys: function(rowKeys) {
                    var that = this,
                        result = new Deferred(),
                        deferreds = [],
                        data = [];

                    each(rowKeys, function(index, key) {
                        deferreds.push(that.byKey(key).done(function(keyData) {
                            data[index] = keyData;
                        }));
                    });

                    when.apply($, deferreds).always(function() {
                        result.resolve(data);
                    });

                    return result;
                },
                /**
                * @name GridBaseMethods.pageIndex
                * @publicName pageIndex()
                * @return numeric
                */
                /**
                * @name GridBaseMethods.pageIndex
                * @publicName pageIndex(newIndex)
                * @param1 newIndex:numeric
                * @return Promise<void>
                */
                pageIndex: function(value) {
                    return changePaging(this, "pageIndex", value);
                },
                /**
                * @name GridBaseMethods.pageSize
                * @publicName pageSize()
                * @return numeric
                */
                /**
                * @name GridBaseMethods.pageSize
                * @publicName pageSize(value)
                * @param1 value:numeric
                */
                pageSize: function(value) {
                    return changePaging(this, "pageSize", value);
                },
                /**
                 * @name GridBaseMethods.beginCustomLoading
                 * @publicName beginCustomLoading(messageText)
                 * @param1 messageText:string
                 */
                beginCustomLoading: function(messageText) {
                    this._isCustomLoading = true;
                    this._loadingText = messageText || '';
                    this._fireLoadingChanged();
                },
                /**
                 * @name GridBaseMethods.endCustomLoading
                 * @publicName endCustomLoading()
                 */
                endCustomLoading: function() {
                    this._isCustomLoading = false;
                    this._loadingText = undefined;
                    this._fireLoadingChanged();
                },
                /**
                 * @name GridBaseMethods.refresh
                 * @publicName refresh()
                 * @return Promise<void>
                 */
                refresh: function() {
                    var that = this,
                        d = new Deferred();

                    when(this._columnsController.refresh()).always(function() {
                        when(that.reload(true)).done(d.resolve).fail(d.reject);
                    });
                    return d;
                },
                /**
                 * @name dxDataGridMethods.getVisibleRows
                 * @publicName getVisibleRows()
                 * @return Array<dxDataGridRowObject>
                 */
                /**
                 * @name dxTreeListMethods.getVisibleRows
                 * @publicName getVisibleRows()
                 * @return Array<dxTreeListRowObject>
                 */
                getVisibleRows: function() {
                    return this.items();
                },
                _disposeDataSource: function() {
                    this.setDataSource(null);
                },

                /**
                * @name GridBaseMethods.repaintRows
                * @publicName repaintRows(rowIndexes)
                * @param1 rowIndexes:Array<number>
                */
                repaintRows: function(rowIndexes) {
                    rowIndexes = Array.isArray(rowIndexes) ? rowIndexes : [rowIndexes];

                    if(rowIndexes.length > 1 || typeUtils.isDefined(rowIndexes[0])) {
                        this.updateItems({ changeType: "update", rowIndices: rowIndexes });
                    }
                },

                skipProcessingPagingChange: function(fullName) {
                    return this._skipProcessingPagingChange && (fullName === "paging.pageIndex" || fullName === "paging.pageSize");
                },

                getUserState: function() {
                    return {
                        searchText: this.option("searchPanel.text"),
                        pageIndex: this.pageIndex(),
                        pageSize: this.pageSize()
                    };
                }
            };

            gridCoreUtils.proxyMethod(members, "load");
            gridCoreUtils.proxyMethod(members, "reload");
            gridCoreUtils.proxyMethod(members, "itemsCount", 0);
            gridCoreUtils.proxyMethod(members, "totalItemsCount", 0);
            gridCoreUtils.proxyMethod(members, "hasKnownLastPage", true);
            gridCoreUtils.proxyMethod(members, "isLoaded", true);
            /**
            * @name dxDataGridMethods.totalCount
            * @publicName totalCount()
            * @return numeric
            */
            gridCoreUtils.proxyMethod(members, "totalCount", 0);

            return members;
        })())
    }
};