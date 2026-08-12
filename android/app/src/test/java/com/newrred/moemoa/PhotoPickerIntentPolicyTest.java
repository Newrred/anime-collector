package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class PhotoPickerIntentPolicyTest {

    @Test
    public void usesPlatformPhotoPickerWhenAvailable() {
        assertEquals("android.provider.action.PICK_IMAGES", PhotoPickerIntentPolicy.actionForSdk(33));
    }

    @Test
    public void usesPermissionlessDocumentPickerOnOlderAndroid() {
        assertEquals("android.intent.action.OPEN_DOCUMENT", PhotoPickerIntentPolicy.actionForSdk(24));
    }
}
