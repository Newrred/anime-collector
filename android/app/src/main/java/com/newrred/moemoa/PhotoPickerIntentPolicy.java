package com.newrred.moemoa;

final class PhotoPickerIntentPolicy {
    private static final String ACTION_PICK_IMAGES = "android.provider.action.PICK_IMAGES";
    private static final String ACTION_OPEN_DOCUMENT = "android.intent.action.OPEN_DOCUMENT";

    private PhotoPickerIntentPolicy() {}

    static String actionForSdk(int sdkInt) {
        return sdkInt >= 33 ? ACTION_PICK_IMAGES : ACTION_OPEN_DOCUMENT;
    }
}
