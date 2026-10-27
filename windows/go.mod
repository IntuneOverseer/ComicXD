module comicxd-windows

go 1.24

require (
	github.com/go-ole/go-ole v1.3.0
	github.com/jchv/go-webview2 v0.0.0
	golang.org/x/sys v0.26.0
)

require github.com/jchv/go-winloader v0.0.0-20250406163304-c1995be93bd1 // indirect

replace github.com/jchv/go-webview2 => ./third_party/go-webview2

replace golang.org/x/sys => github.com/golang/sys v0.26.0
