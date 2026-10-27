.class public Lcom/kalek/comics/MainActivity;
.super Landroid/app/Activity;

.field public web:Landroid/webkit/WebView;
.field public cb:Landroid/webkit/ValueCallback;

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method private hideBars()V
    .locals 2
    invoke-virtual {p0}, Lcom/kalek/comics/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0
    invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v0
    const/16 v1, 0x1706
    invoke-virtual {v0, v1}, Landroid/view/View;->setSystemUiVisibility(I)V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 4
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V
    invoke-virtual {p0}, Lcom/kalek/comics/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0
    const/16 v1, 0x80
    invoke-virtual {v0, v1}, Landroid/view/Window;->addFlags(I)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lcom/kalek/comics/MainActivity;->web:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowContentAccess(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccessFromFileURLs(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowUniversalAccessFromFileURLs(Z)V

    new-instance v1, Lcom/kalek/comics/MainActivity$1;
    invoke-direct {v1, p0}, Lcom/kalek/comics/MainActivity$1;-><init>(Lcom/kalek/comics/MainActivity;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V
    new-instance v1, Landroid/webkit/WebViewClient;
    invoke-direct {v1}, Landroid/webkit/WebViewClient;-><init>()V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V
    new-instance v1, Lcom/kalek/comics/MainActivity$4;
    invoke-direct {v1, p0}, Lcom/kalek/comics/MainActivity$4;-><init>(Lcom/kalek/comics/MainActivity;)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setDownloadListener(Landroid/webkit/DownloadListener;)V

    const v1, -0xe8e5df
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V
    const/4 v1, 0x2
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setOverScrollMode(I)V
    const/4 v1, 0x0
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setVerticalScrollBarEnabled(Z)V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setHorizontalScrollBarEnabled(Z)V
    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v2, 0x1a
    if-lt v1, v2, :sem_prioridade
    const/4 v1, 0x2
    const/4 v2, 0x0
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->setRendererPriorityPolicy(IZ)V
    :sem_prioridade
    invoke-virtual {p0, v0}, Lcom/kalek/comics/MainActivity;->setContentView(Landroid/view/View;)V
    const-string v1, "file:///android_asset/index.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    invoke-direct {p0}, Lcom/kalek/comics/MainActivity;->hideBars()V
    invoke-virtual {p0}, Lcom/kalek/comics/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v1
    invoke-virtual {v1}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v1
    invoke-virtual {v1}, Landroid/view/View;->getViewTreeObserver()Landroid/view/ViewTreeObserver;
    move-result-object v1
    new-instance v2, Lcom/kalek/comics/MainActivity$3;
    invoke-direct {v2, p0}, Lcom/kalek/comics/MainActivity$3;-><init>(Lcom/kalek/comics/MainActivity;)V
    invoke-virtual {v1, v2}, Landroid/view/ViewTreeObserver;->addOnGlobalLayoutListener(Landroid/view/ViewTreeObserver$OnGlobalLayoutListener;)V
    return-void
.end method

.method public onWindowFocusChanged(Z)V
    .locals 0
    invoke-super {p0, p1}, Landroid/app/Activity;->onWindowFocusChanged(Z)V
    if-eqz p1, :fim
    invoke-direct {p0}, Lcom/kalek/comics/MainActivity;->hideBars()V
    :fim
    return-void
.end method

.method public onBackPressed()V
    .locals 3
    iget-object v0, p0, Lcom/kalek/comics/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z
    move-result v1
    if-eqz v1, :js
    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V
    return-void
    :js
    const-string v1, "(function(){var r=document.getElementById('reader');if(r&&!r.hidden){document.getElementById('back').click();return 'ok'}return 'sair'})()"
    new-instance v2, Lcom/kalek/comics/MainActivity$2;
    invoke-direct {v2, p0}, Lcom/kalek/comics/MainActivity$2;-><init>(Lcom/kalek/comics/MainActivity;)V
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V
    return-void
.end method

.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 6
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V
    const/4 v0, 0x1
    if-ne p1, v0, :fim
    iget-object v0, p0, Lcom/kalek/comics/MainActivity;->cb:Landroid/webkit/ValueCallback;
    if-eqz v0, :fim
    const/4 v1, 0x0
    const/4 v5, -0x1
    if-ne p2, v5, :entrega
    if-eqz p3, :entrega
    invoke-virtual {p3}, Landroid/content/Intent;->getClipData()Landroid/content/ClipData;
    move-result-object v2
    if-eqz v2, :unico
    invoke-virtual {v2}, Landroid/content/ClipData;->getItemCount()I
    move-result v3
    new-array v1, v3, [Landroid/net/Uri;
    const/4 v4, 0x0
    :laco
    if-ge v4, v3, :entrega
    invoke-virtual {v2, v4}, Landroid/content/ClipData;->getItemAt(I)Landroid/content/ClipData$Item;
    move-result-object v5
    invoke-virtual {v5}, Landroid/content/ClipData$Item;->getUri()Landroid/net/Uri;
    move-result-object v5
    aput-object v5, v1, v4
    add-int/lit8 v4, v4, 0x1
    goto :laco
    :unico
    invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
    move-result-object v1
    :entrega
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    const/4 v0, 0x0
    iput-object v0, p0, Lcom/kalek/comics/MainActivity;->cb:Landroid/webkit/ValueCallback;
    :fim
    return-void
.end method
