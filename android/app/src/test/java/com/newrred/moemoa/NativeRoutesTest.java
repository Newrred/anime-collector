package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;

import org.junit.Test;

public class NativeRoutesTest {

    @Test
    public void composerUsesExactStaticAssetInsteadOfSpaFallback() {
        assertEquals("/memory/new/index.html", NativeRoutes.memoryComposerPath());
    }

    @Test
    public void manifestKeepsShareTargetAndExactOAuthCallback() throws Exception {
        String manifest = new String(
            Files.readAllBytes(Paths.get("src/main/AndroidManifest.xml")),
            StandardCharsets.UTF_8
        );
        assertTrue(manifest.contains("android.intent.action.SEND"));
        assertTrue(manifest.contains("android.intent.action.VIEW"));
        assertEquals(1, manifest.split("android:scheme=\"com.newrred.moemoa\"", -1).length - 1);
        assertTrue(manifest.contains("android:host=\"auth\""));
        assertTrue(manifest.contains("android:path=\"/callback\""));
    }
}
