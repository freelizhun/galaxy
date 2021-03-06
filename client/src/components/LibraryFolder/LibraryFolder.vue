<template>
    <div>
        <div v-if="!hasLoaded" class="d-flex justify-content-center m-5">
            <font-awesome-icon icon="spinner" spin size="9x" />
        </div>
        <div v-else>
            <FolderTopBar
                @updateSearch="updateSearchValue($event)"
                @refreshTable="refreshTable"
                @fetchFolderContents="fetchFolderContents($event)"
                @deleteFromTable="deleteFromTable"
                :folderContents="folderContents"
                :include_deleted="include_deleted"
                :folder_id="folder_id"
                :selected="selected"
                :metadata="folder_metadata"
            />
            <a class="btn btn-secondary btn-sm btn_open_folder" :href="parentFolder">..</a>

            <b-table
                id="folder_list_body"
                striped
                hover
                :filter="filter"
                :filterIncludedFields="filterOn"
                :fields="fields"
                :items="folderContents"
                :per-page="perPage"
                :current-page="currentPage"
                selectable
                :select-mode="selectMode"
                @row-selected="onRowSelected"
                ref="folder_content_table"
                @filtered="onFiltered"
                show-empty
            >
                <template v-slot:empty>
                    <div class="empty-folder-message">
                        This folder is either empty or you do not have proper access permissions to see the contents. If
                        you expected something to show up please consult the
                        <a href="https://galaxyproject.org/data-libraries/#permissions" target="_blank">
                            library security wikipage
                        </a>
                    </div>
                </template>
                <template v-slot:head(selected)="">
                    <font-awesome-icon
                        @click="toggleSelect"
                        class="select-checkbox cursor-pointer"
                        size="lg"
                        title="Check to select all datasets"
                        :icon="isCheckedAll() ? ['far', 'check-square'] : ['far', 'square']"
                    />
                </template>
                <template v-slot:cell(selected)="row">
                    <font-awesome-icon
                        class="select-checkbox lib-folder-checkbox"
                        size="lg"
                        v-if="!row.item.isNewFolder && !row.item.deleted"
                        :icon="row.rowSelected ? ['far', 'check-square'] : ['far', 'square']"
                    />
                </template>
                <!-- Name -->
                <template v-slot:cell(name)="row">
                    <div v-if="row.item.editMode">
                        <textarea
                            v-if="row.item.isNewFolder"
                            class="form-control"
                            name="input_folder_name"
                            :ref="'name' + row.item.id"
                            v-model="row.item.name"
                            rows="3"
                        />
                        <textarea
                            v-else
                            class="form-control"
                            :ref="'name' + row.item.id"
                            :value="row.item.name"
                            rows="3"
                        />
                    </div>
                    <div v-else-if="!row.item.deleted">
                        <a :href="createContentLink(row.item)">{{ row.item.name }}</a>
                    </div>
                    <!-- Deleted Item-->
                    <div v-else>
                        <div class="deleted-item">{{ row.item.name }}</div>
                    </div>
                </template>

                <!-- Description -->
                <template v-slot:cell(message)="row">
                    <div v-if="row.item.editMode">
                        <textarea
                            v-if="row.item.isNewFolder"
                            class="form-control input_folder_description"
                            :ref="'description' + row.item.id"
                            v-model="row.item.description"
                            rows="3"
                        ></textarea>
                        <textarea
                            v-else
                            class="form-control input_folder_description"
                            :ref="'description' + row.item.id"
                            :value="row.item.description"
                            rows="3"
                        ></textarea>
                    </div>
                    <div v-else>
                        <div class="description-field" v-if="getMessage(row.item)">
                            <div
                                v-if="
                                    getMessage(row.item).length > maxDescriptionLength &&
                                    !expandedMessage.includes(row.item.id)
                                "
                            >
                                <span
                                    class="shrinked-description"
                                    :title="getMessage(row.item)"
                                    v-html="linkify(getMessage(row.item).substring(0, maxDescriptionLength))"
                                >
                                </span>
                                <span :title="getMessage(row.item)"> ...</span>
                                <a class="more-text-btn" @click="expandMessage(row.item)" href="javascript:void(0)"
                                    >(more)</a
                                >
                            </div>
                            <div v-else v-html="linkify(getMessage(row.item))"></div>
                        </div>
                    </div>
                </template>
                <template v-slot:cell(type_icon)="row">
                    <font-awesome-icon v-if="row.item.type === 'folder'" :icon="['far', 'folder']" title="Folder" />
                    <font-awesome-icon v-else-if="row.item.type === 'file'" title="Dataset" :icon="['far', 'file']" />
                </template>
                <template v-slot:cell(raw_size)="row">
                    <div v-if="row.item.type === 'file'" v-html="bytesToString(row.item.raw_size)"></div>
                </template>
                <template v-slot:cell(state)="row">
                    <div v-if="row.item.state != 'ok'">
                        {{ row.item.state }}
                    </div>
                </template>
                <template v-slot:cell(update_time)="row">
                    <UtcDate
                        v-if="row.item.update_time"
                        :date="row.item.update_time"
                        custom-format="'YYYY-MM-DD- HH:mm a'"
                        mode="elapsed"
                    />
                </template>
                <template v-slot:cell(is_unrestricted)="row">
                    <font-awesome-icon v-if="row.item.is_unrestricted" title="Unrestricted dataset" icon="globe" />
                    <font-awesome-icon
                        v-else-if="row.item.deleted"
                        title="Marked deleted"
                        icon="ban"
                    ></font-awesome-icon>
                    <font-awesome-icon v-else-if="row.item.is_private" title="Private dataset" icon="key" />
                    <font-awesome-icon
                        v-else-if="row.item.is_private === false && row.item.is_unrestricted === false"
                        title="Restricted dataset"
                        icon="shield-alt"
                    />
                </template>

                <template v-slot:cell(buttons)="row">
                    <div v-if="row.item.editMode">
                        <button
                            @click="row.item.isNewFolder ? createNewFolder(row.item) : saveChanges(row.item)"
                            class="primary-button btn-sm permission_folder_btn save_folder_btn"
                            :title="'save ' + row.item.name"
                        >
                            <font-awesome-icon :icon="['far', 'save']" />
                            Save
                        </button>
                        <button
                            class="primary-button btn-sm permission_folder_btn"
                            title="Discard Changes"
                            @click="toggleEditMode(row.item)"
                        >
                            <font-awesome-icon :icon="['fas', 'times']" />
                            Cancel
                        </button>
                    </div>
                    <div v-else>
                        <b-button
                            v-if="row.item.can_manage && !row.item.deleted && row.item.type === 'folder'"
                            @click="toggleEditMode(row.item)"
                            data-toggle="tooltip"
                            data-placement="top"
                            size="sm"
                            class="lib-btn permission_folder_btn edit_folder_btn"
                            :title="'Edit ' + row.item.name"
                        >
                            <font-awesome-icon icon="pencil-alt" />
                            Edit
                        </b-button>
                        <b-button
                            v-if="row.item.can_manage && !row.item.deleted"
                            :href="createPermissionLink(row.item)"
                            data-toggle="tooltip"
                            data-placement="top"
                            size="sm"
                            class="lib-btn permission_folder_btn"
                            :title="'Permissions of ' + row.item.name"
                        >
                            <font-awesome-icon icon="users" />
                            Manage
                        </b-button>
                        <button
                            @click="undelete(row.item)"
                            v-if="row.item.deleted"
                            :title="'Undelete ' + row.item.name"
                            class="lib-btn primary-button btn-sm undelete_dataset_btn"
                            type="button"
                        >
                            <font-awesome-icon icon="unlock" />
                            Undelete
                        </button>
                    </div>
                </template>
            </b-table>
            <b-container>
                <b-row class="justify-content-md-center">
                    <b-col md="auto">
                        <b-pagination
                            v-model="currentPage"
                            :total-rows="rows"
                            :per-page="perPage"
                            aria-controls="folder_list_body"
                        >
                        </b-pagination>
                    </b-col>
                    <b-col cols="1.5">
                        <table>
                            <tr>
                                <td class="m-0 p-0">
                                    <b-form-input
                                        class="pagination-input-field"
                                        id="paginationPerPage"
                                        autocomplete="off"
                                        type="number"
                                        v-model="perPage"
                                    />
                                </td>
                                <td class="text-muted ml-1 paginator-text">
                                    <span class="pagination-total-pages-text">per page, {{ rows }} total</span>
                                </td>
                            </tr>
                        </table>
                    </b-col>
                </b-row>
            </b-container>
        </div>
    </div>
</template>

<script>
import Vue from "vue";
import { getAppRoot } from "onload/loadConfig";
import UtcDate from "components/UtcDate";
import BootstrapVue from "bootstrap-vue";
import { Services } from "./services";
import Utils from "utils/utils";
import linkify from "linkifyjs/html";
import { fields } from "./table-fields";
import { Toast } from "ui/toast";
import FolderTopBar from "./TopToolbar/FolderTopBar";
import { initFolderTableIcons } from "./icons.js";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

initFolderTableIcons();

Vue.use(BootstrapVue);

export default {
    props: {
        folder_id: {
            type: String,
            required: true,
        },
    },
    components: {
        FolderTopBar,
        UtcDate,
        FontAwesomeIcon,
    },
    data() {
        return {
            error: null,
            folder_metadata: null,
            currentPage: 1,
            fields: fields,
            selectMode: "multi",
            selected: [],
            expandedMessage: [],
            folderContents: [],
            hasLoaded: false,
            perPage: 15,
            maxDescriptionLength: 40,
            filter: null,
            include_deleted: false,
            filterOn: [],
        };
    },
    computed: {
        rows() {
            return this.folderContents.length;
        },
        parentFolder() {
            const path = this.folder_metadata.full_path;
            if (path.length === 1) {
                return `${this.root}library/list/`;
            } else {
                return `${this.root}library/folders/${path[path.length - 2][0]}`;
            }
        },
    },
    created() {
        this.root = getAppRoot();
        this.services = new Services({ root: this.root });

        this.fetchFolderContents();
    },
    methods: {
        fetchFolderContents(include_deleted = false) {
            this.include_deleted = include_deleted;
            this.hasLoaded = false;
            this.services
                .getFolderContents(this.folder_id, include_deleted)
                .then((response) => {
                    this.folderContents = response.folder_contents;
                    this.folder_metadata = response.metadata;
                    this.hasLoaded = true;
                })
                .catch((error) => {
                    this.error = error;
                });
        },
        updateSearchValue(value) {
            this.filter = value;
        },
        selectAllRows() {
            this.$refs.folder_content_table.selectAllRows();
        },
        clearSelected() {
            this.$refs.folder_content_table.clearSelected();
        },
        refreshTable() {
            this.$refs.folder_content_table.refresh();
        },
        deleteFromTable(deletedItem) {
            this.folderContents = this.folderContents.filter((element) => {
                if (element.id !== deletedItem.id) {
                    return element;
                }
            });
        },
        isCheckedAll() {
            if (!this.$refs.folder_content_table) return false;

            // Since we cannot select new folders, toggle should clear all if all rows match, expect new folders
            let unselectable = 0;

            this.$refs.folder_content_table.computedItems.forEach((row) => {
                if (row.isNewFolder || row.deleted) unselectable++;
            });
            return this.selected.length + unselectable == this.$refs.folder_content_table.computedItems.length;
        },
        toggleSelect() {
            if (this.isCheckedAll()) {
                this.clearSelected();
            } else {
                this.selectAllRows();
            }
        },
        onRowSelected(items) {
            // make new folders not selectable
            // https://github.com/bootstrap-vue/bootstrap-vue/issues/3134#issuecomment-526810892
            for (let i = 0; i < items.length; i++) {
                if (items[i].isNewFolder || items[i].deleted) this.$refs.folder_content_table.unselectRow(i);
            }
            this.selected = items;
        },
        bytesToString(raw_size) {
            return Utils.bytesToString(raw_size);
        },
        createContentLink(element) {
            if (element.type === "file")
                return `${this.root}library/list#folders/${this.folder_id}/datasets/${element.id}`;
            else if (element.type === "folder") return `${this.root}library/folders/${element.id}`;
        },
        createPermissionLink(element) {
            if (element.type === "file") return `${this.createContentLink(element)}/permissions`;
            else if (element.type === "folder") return `${this.root}library/list#folders/${element.id}/permissions`;
        },
        getMessage(element) {
            if (element.type === "file") return element.message;
            else if (element.type === "folder") return element.description;
        },
        expandMessage(element) {
            this.expandedMessage.push(element.id);
        },
        linkify(raw_text) {
            return linkify(raw_text);
        },
        toggleEditMode(item) {
            item.editMode = !item.editMode;
            this.folderContents = this.folderContents.filter((item) => {
                if (!item.isNewFolder) return item;
            });
            this.refreshTable();
        },
        onFiltered(filteredItems) {
            // Trigger pagination to update the number of buttons/pages due to filtering
            this.totalRows = filteredItems.length;
            this.currentPage = 1;
        },
        createNewFolder: function (folder) {
            if (!folder.name) {
                Toast.error("Folder's name is missing.");
            } else if (folder.name.length < 3) {
                Toast.warning("Folder name has to be at least 3 characters long.");
            } else {
                this.services.newFolder(
                    {
                        parent_id: this.folder_id,
                        name: folder.name,
                        description: folder.description,
                    },
                    (resp) => {
                        folder.id = resp.id;
                        folder.update_time = resp.update_time;
                        folder.editMode = false;
                        folder.can_manage = true;
                        folder.isNewFolder = false;

                        this.refreshTable();
                        Toast.success("Folder created.");
                    },
                    () => {
                        Toast.error("An error occurred.");
                    }
                );
            }
        },
        undelete: function (element) {
            const onError = (response) => {
                const message = `${element.type === "folder" ? "Folder" : "Dataset"}`;
                if (typeof response.responseJSON !== "undefined") {
                    Toast.error(`${message} was not undeleted. ${response.responseJSON.err_msg}`);
                } else {
                    Toast.error(`An error occurred! ${message} was not undeleted. Please try again.`);
                }
            };
            if (element.type === "folder")
                this.services.undeleteFolder(
                    element,
                    (response) => {
                        element.deleted = response.deleted;
                        this.refreshTable();
                        Toast.success("Folder undeleted.");
                    },
                    onError
                );
            else
                this.services.undeleteDataset(
                    element,
                    (response) => {
                        element.deleted = response.deleted;
                        this.refreshTable();
                        Toast.success("Dataset undeleted. Click this to see it.", "", {
                            onclick: function () {
                                window.location = `${getAppRoot()}library/list#folders/${this.folder_id}/datasets/${
                                    element.id
                                }`;
                            },
                        });
                    },
                    onError
                );
        },

        /*
         Former Backbone code, adopted to work with Vue
        */
        saveChanges(folder) {
            let is_changed = false;
            const new_name = this.$refs[`name${folder.id}`].value;
            if (new_name && new_name !== folder.name) {
                if (new_name.length > 2) {
                    folder.name = new_name;
                    is_changed = true;
                } else {
                    Toast.warning("Folder name has to be at least 3 characters long.");
                    return;
                }
            }
            const new_description = this.$refs[`description${folder.id}`].value;
            if (typeof new_description !== "undefined" && new_description !== folder.description) {
                folder.description = new_description;
                is_changed = true;
            }
            if (is_changed) {
                this.services.updateFolder(
                    folder,
                    () => {
                        Toast.success("Changes to folder saved.");
                        folder.editMode = false;
                        this.refreshTable();
                    },
                    (error) => {
                        if (error.data && error.data.err_msg) {
                            Toast.error(error.data.err_msg);
                        } else {
                            Toast.error("An error occurred while attempting to update the folder.");
                        }
                    }
                );
            } else {
                Toast.info("Nothing has changed.");
            }
        },
    },
};
</script>

<style scoped>
@import "library-folder-table.css";
</style>
