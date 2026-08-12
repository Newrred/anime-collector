package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class NativeRoutesTest {

    @Test
    public void composerUsesExactStaticAssetInsteadOfSpaFallback() {
        assertEquals("/memory/new/index.html", NativeRoutes.memoryComposerPath());
    }
}
