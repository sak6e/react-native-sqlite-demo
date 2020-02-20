/**
 * React Native SQLite Demo
 * Copyright (c) 2018-2020 Bruce Lefebvre <bruce@brucelefebvre.com>
 * https://github.com/blefebvre/react-native-sqlite-demo/blob/master/LICENSE
 */
import React, { useState } from "react";
import { View, StyleSheet, Modal, Text, SafeAreaView, TouchableOpacity, Alert } from "react-native";
import RNRestart from "react-native-restart";
import { Header } from "./Header";
import { sharedStyle } from "../style/Shared";
import { DropboxAuthorize } from "../sync/dropbox/DropboxAuthorize";
import { DropboxDatabaseSync } from "../sync/dropbox/DropboxDatabaseSync";
import { LoadingScreen } from "./LoadingScreen";

interface Props {
  visible: boolean;
  back(): void;
}

const dropboxAuth: DropboxAuthorize = new DropboxAuthorize();
const dropboxSync: DropboxDatabaseSync = new DropboxDatabaseSync();

export const SettingsModal: React.FunctionComponent<Props> = function(props) {
  const { visible } = props;
  // Initialize state
  const [isDropboxStatusKnown, setIsDropboxStatusKnown] = useState(false);
  const [hasAuthorizedWithDropbox, setHasAuthorizedWithDropbox] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  function renderDropboxComponents() {
    if (hasAuthorizedWithDropbox) {
      return (
        <View>
          <Text>
            ✅ You have authorized the app to backup and sync your database file using Dropbox! Tap below to unlink.
          </Text>

          <TouchableOpacity style={styles.dropboxButton} onPress={promptToUnlinkFromDropbox} testID="unlinkButton">
            <Text>Unlink Dropbox</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      return (
        <View>
          <Text>Tap below to authorize the app to backup and sync your database file with Dropbox.</Text>

          <TouchableOpacity style={styles.dropboxButton} onPress={authorizeWithDropbox} testID="authorizeButton">
            <Text>Authorize with Dropbox</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  // Begin authorization flow
  async function authorizeWithDropbox(): Promise<void> {
    // Begin authorization flow with Dropbox
    await dropboxAuth.authorize();
    setHasAuthorizedWithDropbox(true);

    // Check if the remote DB file is newer than the copy we have on device
    try {
      const remoteDatabaseIsNewer = await dropboxSync.hasRemoteUpdate();
      if (remoteDatabaseIsNewer) {
        // We just linked, and there is existing data on Dropbox. Prompt to overwrite it.
        Alert.alert(
          "Replace local database?",
          "Would you like to overwrite the app's current database with the version on Dropbox?",
          [
            {
              text: "Yes, replace my local DB",
              onPress: async function overwriteLocalDB() {
                console.log("User chose to replace the local DB.");
                // Download the update
                try {
                  setIsDownloading(true);
                  // Download the database from Dropbox
                  await dropboxSync.download();
                  console.log("DB download success! Reloading app.");
                  RNRestart.Restart();
                } catch (reason) {
                  // Error!
                  setIsDownloading(false);
                  console.error("Error downloading database from Dropbox. Reason: " + reason);
                }
              },
            },
            {
              text: "No, unlink Dropbox",
              onPress: () => unlinkFromDropbox(),
            },
          ],
          { cancelable: false },
        );
      } else {
        // Nothing exists on Dropbox yet, so kick off the 1st upload
        return dropboxSync.upload();
      }
    } catch (reason) {
      Alert.alert("Error", `Unable to authorize with Dropbox. Reason: ${reason}`);
    }
  }

  function promptToUnlinkFromDropbox() {
    Alert.alert(
      "Unlink Dropbox",
      "Are you sure you would like to unlink Dropbox? Your data will remain on this device, but it will no longer be backed up or synced.",
      [
        {
          text: "No",
          onPress: () => {
            // No-op
            return;
          },
        },
        {
          text: "Yes, unlink",
          onPress: () => unlinkFromDropbox(),
          style: "destructive",
        },
      ],
    );
  }

  async function unlinkFromDropbox() {
    console.log("Unlinking from Dropbox.");
    await dropboxAuth.revokeAuthorization();
    setHasAuthorizedWithDropbox(false);
  }

  async function modalOnShow() {
    // Check if this user has already authorized with Dropbox
    const isAuthorized = await dropboxAuth.hasUserAuthorized();
    setIsDropboxStatusKnown(true);
    setHasAuthorizedWithDropbox(isAuthorized);
  }

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={() => props.back()}
      onShow={modalOnShow}>
      {isDownloading ? (
        <LoadingScreen text="Downloading database..." />
      ) : (
        <SafeAreaView style={styles.container} testID="settingsModal">
          <View style={sharedStyle.headerWithButton}>
            <Header title={`Settings`} />

            <TouchableOpacity style={sharedStyle.headerButton} onPress={() => props.back()}>
              <Text>✖️</Text>
            </TouchableOpacity>
          </View>

          {isDropboxStatusKnown && renderDropboxComponents()}
        </SafeAreaView>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  dropboxButton: {
    alignItems: "center",
    margin: 10,
    marginTop: 25,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderRadius: 3,
  },
});
