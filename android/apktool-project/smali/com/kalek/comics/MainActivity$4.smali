.class Lcom/kalek/comics/MainActivity$4;
.super Ljava/lang/Object;
.implements Landroid/webkit/DownloadListener;

.field final a:Lcom/kalek/comics/MainActivity;

.method constructor <init>(Lcom/kalek/comics/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/kalek/comics/MainActivity$4;->a:Lcom/kalek/comics/MainActivity;
    return-void
.end method

.method public onDownloadStart(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;J)V
    .locals 3
    :try_ini
    invoke-static {p1}, Landroid/net/Uri;->parse(Ljava/lang/String;)Landroid/net/Uri;
    move-result-object v0
    new-instance v1, Landroid/content/Intent;
    const-string v2, "android.intent.action.VIEW"
    invoke-direct {v1, v2, v0}, Landroid/content/Intent;-><init>(Ljava/lang/String;Landroid/net/Uri;)V
    iget-object v2, p0, Lcom/kalek/comics/MainActivity$4;->a:Lcom/kalek/comics/MainActivity;
    invoke-virtual {v2, v1}, Lcom/kalek/comics/MainActivity;->startActivity(Landroid/content/Intent;)V
    :try_fim
    .catch Ljava/lang/Exception; {:try_ini .. :try_fim} :fim
    :fim
    return-void
.end method
