.class Lcom/kalek/comics/MainActivity$3;
.super Ljava/lang/Object;
.implements Landroid/view/ViewTreeObserver$OnGlobalLayoutListener;

.field final a:Lcom/kalek/comics/MainActivity;
.field final r:Landroid/graphics/Rect;

.method constructor <init>(Lcom/kalek/comics/MainActivity;)V
    .locals 1
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lcom/kalek/comics/MainActivity$3;->a:Lcom/kalek/comics/MainActivity;
    new-instance v0, Landroid/graphics/Rect;
    invoke-direct {v0}, Landroid/graphics/Rect;-><init>()V
    iput-object v0, p0, Lcom/kalek/comics/MainActivity$3;->r:Landroid/graphics/Rect;
    return-void
.end method

.method public onGlobalLayout()V
    .locals 10
    iget-object v0, p0, Lcom/kalek/comics/MainActivity$3;->a:Lcom/kalek/comics/MainActivity;
    invoke-virtual {v0}, Lcom/kalek/comics/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v1
    invoke-virtual {v1}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v1
    iget-object v2, p0, Lcom/kalek/comics/MainActivity$3;->r:Landroid/graphics/Rect;
    invoke-virtual {v1, v2}, Landroid/view/View;->getWindowVisibleDisplayFrame(Landroid/graphics/Rect;)V
    invoke-virtual {v1}, Landroid/view/View;->getRootView()Landroid/view/View;
    move-result-object v1
    invoke-virtual {v1}, Landroid/view/View;->getHeight()I
    move-result v1
    if-lez v1, :fim
    iget v2, v2, Landroid/graphics/Rect;->bottom:I
    sub-int v3, v1, v2
    div-int/lit8 v4, v1, 0x6
    iget-object v5, v0, Lcom/kalek/comics/MainActivity;->web:Landroid/webkit/WebView;
    if-le v3, v4, :sem_teclado
    const/4 v8, 0x2
    new-array v8, v8, [I
    invoke-virtual {v5, v8}, Landroid/view/View;->getLocationOnScreen([I)V
    const/4 v9, 0x1
    aget v9, v8, v9
    sub-int v6, v2, v9
    if-lez v6, :fim
    goto :aplica
    :sem_teclado
    const/4 v6, -0x1
    :aplica
    invoke-virtual {v5}, Landroid/view/View;->getLayoutParams()Landroid/view/ViewGroup$LayoutParams;
    move-result-object v7
    if-eqz v7, :fim
    iget v2, v7, Landroid/view/ViewGroup$LayoutParams;->height:I
    if-eq v2, v6, :fim
    iput v6, v7, Landroid/view/ViewGroup$LayoutParams;->height:I
    invoke-virtual {v5, v7}, Landroid/view/View;->setLayoutParams(Landroid/view/ViewGroup$LayoutParams;)V
    :fim
    return-void
.end method
