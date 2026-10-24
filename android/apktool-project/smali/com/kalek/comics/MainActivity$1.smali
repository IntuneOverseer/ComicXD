.class Lcom/kalek/comics/MainActivity$1;
.super Landroid/webkit/WebChromeClient;

.field final a:Lcom/kalek/comics/MainActivity;

.method constructor <init>(Lcom/kalek/comics/MainActivity;)V
    .locals 0
    iput-object p1, p0, Lcom/kalek/comics/MainActivity$1;->a:Lcom/kalek/comics/MainActivity;
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    return-void
.end method

.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 4
    iget-object v0, p0, Lcom/kalek/comics/MainActivity$1;->a:Lcom/kalek/comics/MainActivity;
    iget-object v1, v0, Lcom/kalek/comics/MainActivity;->cb:Landroid/webkit/ValueCallback;
    if-eqz v1, :guarda
    const/4 v2, 0x0
    invoke-interface {v1, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :guarda
    iput-object p2, v0, Lcom/kalek/comics/MainActivity;->cb:Landroid/webkit/ValueCallback;
    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->createIntent()Landroid/content/Intent;
    move-result-object v1
    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->getMode()I
    move-result v2
    const/4 v3, 0x1
    if-ne v2, v3, :abre
    const-string v2, "android.intent.extra.ALLOW_MULTIPLE"
    invoke-virtual {v1, v2, v3}, Landroid/content/Intent;->putExtra(Ljava/lang/String;Z)Landroid/content/Intent;
    :abre
    :try_start_0
    invoke-virtual {v0, v1, v3}, Lcom/kalek/comics/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :erro
    return v3
    :erro
    const/4 v2, 0x0
    iput-object v2, v0, Lcom/kalek/comics/MainActivity;->cb:Landroid/webkit/ValueCallback;
    invoke-interface {p2, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    const/4 v3, 0x0
    return v3
.end method
