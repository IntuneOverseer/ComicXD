.class Lcom/kalek/comics/MainActivity$2;
.super Ljava/lang/Object;
.implements Landroid/webkit/ValueCallback;

.field final a:Lcom/kalek/comics/MainActivity;

.method constructor <init>(Lcom/kalek/comics/MainActivity;)V
    .locals 0
    iput-object p1, p0, Lcom/kalek/comics/MainActivity$2;->a:Lcom/kalek/comics/MainActivity;
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    return-void
.end method

.method public onReceiveValue(Ljava/lang/Object;)V
    .locals 1
    const-string v0, "\"sair\""
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v0
    if-eqz v0, :fim
    iget-object v0, p0, Lcom/kalek/comics/MainActivity$2;->a:Lcom/kalek/comics/MainActivity;
    invoke-virtual {v0}, Lcom/kalek/comics/MainActivity;->finish()V
    :fim
    return-void
.end method
