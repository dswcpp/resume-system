# MFC开发技术笔记

## 一、MFC基础知识

### 1.1 MFC框架概述

MFC (Microsoft Foundation Classes) 是微软提供的C++类库，封装了Win32 API。

**MFC与Win32 API的关系**：
```cpp
// Win32 API方式创建窗口
HWND hwnd = CreateWindow(
    "MyWindowClass", "Title",
    WS_OVERLAPPEDWINDOW,
    CW_USEDEFAULT, CW_USEDEFAULT, 800, 600,
    NULL, NULL, hInstance, NULL);

// MFC方式
class CMyWnd : public CFrameWnd {
public:
    CMyWnd() {
        Create(NULL, _T("Title"));
    }
};
```

### 1.2 核心基础类

**类层次结构**：
```
CObject                 ← 根类
├── CCmdTarget          ← 命令目标（消息处理）
│   ├── CWinThread      ← 线程
│   │   └── CWinApp     ← 应用程序
│   └── CWnd            ← 窗口基类
│       ├── CFrameWnd   ← 框架窗口
│       ├── CDialog     ← 对话框
│       └── CView       ← 视图
└── CDocument           ← 文档
```

**CString使用**：
```cpp
CString str1 = _T("Hello");
CString str2;
str2.Format(_T("Value: %d"), 123);
str1 += str2;

// 转换
const char* pChar = CT2A(str1);     // CString → char*
CString str3 = CA2T(pChar);         // char* → CString
std::string std_str = CT2A(str1);   // CString → std::string
```

### 1.3 消息映射机制

**消息映射宏**：
```cpp
// 头文件
class CMyWnd : public CFrameWnd {
    DECLARE_MESSAGE_MAP()
public:
    afx_msg void OnPaint();
    afx_msg void OnLButtonDown(UINT nFlags, CPoint point);
    afx_msg LRESULT OnMyMessage(WPARAM wParam, LPARAM lParam);
};

// 源文件
BEGIN_MESSAGE_MAP(CMyWnd, CFrameWnd)
    ON_WM_PAINT()
    ON_WM_LBUTTONDOWN()
    ON_MESSAGE(WM_MY_MESSAGE, OnMyMessage)
    ON_COMMAND(ID_FILE_OPEN, OnFileOpen)       // 菜单/按钮命令
    ON_BN_CLICKED(IDC_BUTTON1, OnButton1)      // 按钮点击
END_MESSAGE_MAP()

void CMyWnd::OnPaint() {
    CPaintDC dc(this);
    dc.TextOut(10, 10, _T("Hello"));
}

void CMyWnd::OnLButtonDown(UINT nFlags, CPoint point) {
    CString msg;
    msg.Format(_T("Click at (%d, %d)"), point.x, point.y);
    MessageBox(msg);
}
```

**自定义消息**：
```cpp
#define WM_MY_MESSAGE (WM_USER + 100)

// 发送消息
PostMessage(WM_MY_MESSAGE, wParam, lParam);
SendMessage(WM_MY_MESSAGE, wParam, lParam);

// 处理消息
LRESULT CMyWnd::OnMyMessage(WPARAM wParam, LPARAM lParam) {
    // 处理逻辑
    return 0;
}
```

---

## 二、MFC应用程序架构

### 2.1 应用程序入口

```cpp
// 应用程序类
class CMyApp : public CWinApp {
public:
    virtual BOOL InitInstance() override {
        // 初始化公共控件
        InitCommonControls();
        
        // 创建主窗口
        CMainFrame* pFrame = new CMainFrame();
        if (!pFrame->LoadFrame(IDR_MAINFRAME)) {
            return FALSE;
        }
        m_pMainWnd = pFrame;
        pFrame->ShowWindow(SW_SHOW);
        pFrame->UpdateWindow();
        
        return TRUE;
    }
    
    virtual int ExitInstance() override {
        // 清理资源
        return CWinApp::ExitInstance();
    }
};

// 唯一的应用程序实例
CMyApp theApp;
```

### 2.2 文档/视图架构

```cpp
// 文档类
class CMyDoc : public CDocument {
    DECLARE_DYNCREATE(CMyDoc)
    
    CString m_data;
    
public:
    virtual BOOL OnNewDocument() override {
        if (!CDocument::OnNewDocument())
            return FALSE;
        m_data = _T("New Document");
        return TRUE;
    }
    
    virtual void Serialize(CArchive& ar) override {
        if (ar.IsStoring()) {
            ar << m_data;
        } else {
            ar >> m_data;
        }
    }
    
    CString GetData() const { return m_data; }
    void SetData(const CString& data) {
        m_data = data;
        SetModifiedFlag();
        UpdateAllViews(NULL);
    }
};

// 视图类
class CMyView : public CView {
    DECLARE_DYNCREATE(CMyView)
    
public:
    CMyDoc* GetDocument() const {
        return reinterpret_cast<CMyDoc*>(m_pDocument);
    }
    
    virtual void OnDraw(CDC* pDC) override {
        CMyDoc* pDoc = GetDocument();
        pDC->TextOut(10, 10, pDoc->GetData());
    }
};

// 注册文档模板
BOOL CMyApp::InitInstance() {
    CSingleDocTemplate* pDocTemplate = new CSingleDocTemplate(
        IDR_MAINFRAME,
        RUNTIME_CLASS(CMyDoc),
        RUNTIME_CLASS(CMainFrame),
        RUNTIME_CLASS(CMyView));
    AddDocTemplate(pDocTemplate);
    
    // ...
}
```

---

## 三、界面开发

### 3.1 对话框编程

```cpp
// 对话框类
class CMyDialog : public CDialog {
    DECLARE_MESSAGE_MAP()
    
    CEdit m_editName;
    CString m_strName;
    
public:
    enum { IDD = IDD_MY_DIALOG };
    
    CMyDialog(CWnd* pParent = nullptr) 
        : CDialog(IDD, pParent) {}
    
protected:
    virtual void DoDataExchange(CDataExchange* pDX) override {
        CDialog::DoDataExchange(pDX);
        DDX_Control(pDX, IDC_EDIT_NAME, m_editName);
        DDX_Text(pDX, IDC_EDIT_NAME, m_strName);
        DDV_MaxChars(pDX, m_strName, 100);
    }
    
    virtual BOOL OnInitDialog() override {
        CDialog::OnInitDialog();
        m_editName.SetWindowText(_T("默认值"));
        return TRUE;
    }
    
    afx_msg void OnOK() override {
        UpdateData(TRUE);  // 控件→变量
        // 验证数据
        if (m_strName.IsEmpty()) {
            AfxMessageBox(_T("名称不能为空"));
            return;
        }
        CDialog::OnOK();
    }
};

// 使用对话框
CMyDialog dlg;
if (dlg.DoModal() == IDOK) {
    CString name = dlg.m_strName;
}
```

### 3.2 常用控件

**列表控件**：
```cpp
// 初始化列表
CListCtrl m_list;
m_list.SetExtendedStyle(LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES);
m_list.InsertColumn(0, _T("ID"), LVCFMT_LEFT, 50);
m_list.InsertColumn(1, _T("名称"), LVCFMT_LEFT, 100);

// 添加数据
int nItem = m_list.InsertItem(0, _T("1"));
m_list.SetItemText(nItem, 1, _T("项目1"));

// 获取选中项
POSITION pos = m_list.GetFirstSelectedItemPosition();
while (pos) {
    int nIndex = m_list.GetNextSelectedItem(pos);
    CString strText = m_list.GetItemText(nIndex, 0);
}
```

**树控件**：
```cpp
CTreeCtrl m_tree;
HTREEITEM hRoot = m_tree.InsertItem(_T("根节点"));
HTREEITEM hChild = m_tree.InsertItem(_T("子节点"), hRoot);
m_tree.Expand(hRoot, TVE_EXPAND);
```

### 3.3 自绘控件

```cpp
// Owner Draw按钮
class CMyButton : public CButton {
protected:
    virtual void DrawItem(LPDRAWITEMSTRUCT lpDrawItemStruct) override {
        CDC dc;
        dc.Attach(lpDrawItemStruct->hDC);
        
        CRect rect = lpDrawItemStruct->rcItem;
        UINT state = lpDrawItemStruct->itemState;
        
        // 绘制背景
        if (state & ODS_SELECTED) {
            dc.FillSolidRect(rect, RGB(200, 200, 255));
        } else {
            dc.FillSolidRect(rect, RGB(240, 240, 240));
        }
        
        // 绘制文字
        CString strText;
        GetWindowText(strText);
        dc.SetBkMode(TRANSPARENT);
        dc.DrawText(strText, rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        
        dc.Detach();
    }
};
```

---

## 四、GDI绘图

### 4.1 基础绘图

```cpp
void CMyView::OnDraw(CDC* pDC) {
    // 画笔和画刷
    CPen pen(PS_SOLID, 2, RGB(255, 0, 0));
    CBrush brush(RGB(0, 255, 0));
    
    CPen* pOldPen = pDC->SelectObject(&pen);
    CBrush* pOldBrush = pDC->SelectObject(&brush);
    
    // 绘制图形
    pDC->Rectangle(10, 10, 100, 100);
    pDC->Ellipse(110, 10, 200, 100);
    pDC->MoveTo(10, 120);
    pDC->LineTo(200, 120);
    
    // 恢复
    pDC->SelectObject(pOldPen);
    pDC->SelectObject(pOldBrush);
}
```

### 4.2 双缓冲绘图（消除闪烁）

```cpp
void CMyView::OnDraw(CDC* pDC) {
    CRect rect;
    GetClientRect(&rect);
    
    // 创建内存DC和位图
    CDC memDC;
    memDC.CreateCompatibleDC(pDC);
    
    CBitmap bitmap;
    bitmap.CreateCompatibleBitmap(pDC, rect.Width(), rect.Height());
    CBitmap* pOldBitmap = memDC.SelectObject(&bitmap);
    
    // 在内存DC上绘制
    memDC.FillSolidRect(rect, RGB(255, 255, 255));
    // ... 绑制内容 ...
    
    // 一次性复制到屏幕
    pDC->BitBlt(0, 0, rect.Width(), rect.Height(),
                &memDC, 0, 0, SRCCOPY);
    
    // 清理
    memDC.SelectObject(pOldBitmap);
}

// 防止背景擦除
BOOL CMyView::OnEraseBkgnd(CDC* pDC) {
    return TRUE;  // 不擦除背景
}
```

### 4.3 位图操作

```cpp
// 加载位图
CBitmap bitmap;
bitmap.LoadBitmap(IDB_BITMAP1);

// 从文件加载
CImage image;
image.Load(_T("C:\\image.png"));

// 绘制位图
CDC memDC;
memDC.CreateCompatibleDC(pDC);
CBitmap* pOldBitmap = memDC.SelectObject(&bitmap);

BITMAP bm;
bitmap.GetBitmap(&bm);

pDC->BitBlt(0, 0, bm.bmWidth, bm.bmHeight, &memDC, 0, 0, SRCCOPY);

// 拉伸绘制
pDC->StretchBlt(0, 0, 200, 200, &memDC, 0, 0, 
                bm.bmWidth, bm.bmHeight, SRCCOPY);
```

---

## 五、MFC多线程

### 5.1 工作者线程

```cpp
// 线程函数
UINT MyThreadProc(LPVOID pParam) {
    CMyView* pView = (CMyView*)pParam;
    
    for (int i = 0; i < 100; i++) {
        // 执行耗时操作
        Sleep(100);
        
        // 通知UI线程更新
        pView->PostMessage(WM_UPDATE_PROGRESS, i, 0);
    }
    
    return 0;
}

// 启动线程
AfxBeginThread(MyThreadProc, this);
```

### 5.2 同步对象

```cpp
// 临界区
CCriticalSection m_cs;

void ThreadSafeFunction() {
    CSingleLock lock(&m_cs, TRUE);  // 自动加锁解锁
    // 访问共享资源
}

// 事件
CEvent m_event;

// 线程1：等待事件
WaitForSingleObject(m_event, INFINITE);

// 线程2：触发事件
m_event.SetEvent();
```

### 5.3 UI线程更新

```cpp
// 错误：直接从工作线程更新UI
// m_editStatus.SetWindowText(_T("完成")); ← 会崩溃

// 正确：发送消息到UI线程
PostMessage(WM_UPDATE_UI, 0, (LPARAM)new CString(_T("完成")));

// UI线程处理
LRESULT CMyDlg::OnUpdateUI(WPARAM wParam, LPARAM lParam) {
    CString* pStr = (CString*)lParam;
    m_editStatus.SetWindowText(*pStr);
    delete pStr;
    return 0;
}
```

---

## 六、串口通信（MFC方式）

### 6.1 使用CSerialPort类

```cpp
// 简化的串口封装类
class CSerialPort {
    HANDLE m_hComm;
    
public:
    bool Open(const CString& port, int baudRate) {
        m_hComm = CreateFile(
            _T("\\\\.\\") + port,
            GENERIC_READ | GENERIC_WRITE,
            0, NULL, OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL, NULL);
        
        if (m_hComm == INVALID_HANDLE_VALUE)
            return false;
        
        // 配置串口
        DCB dcb = {0};
        dcb.DCBlength = sizeof(DCB);
        GetCommState(m_hComm, &dcb);
        dcb.BaudRate = baudRate;
        dcb.ByteSize = 8;
        dcb.Parity = NOPARITY;
        dcb.StopBits = ONESTOPBIT;
        SetCommState(m_hComm, &dcb);
        
        // 设置超时
        COMMTIMEOUTS timeouts = {0};
        timeouts.ReadIntervalTimeout = 50;
        timeouts.ReadTotalTimeoutConstant = 100;
        SetCommTimeouts(m_hComm, &timeouts);
        
        return true;
    }
    
    int Read(BYTE* buffer, int size) {
        DWORD bytesRead = 0;
        ReadFile(m_hComm, buffer, size, &bytesRead, NULL);
        return bytesRead;
    }
    
    int Write(const BYTE* buffer, int size) {
        DWORD bytesWritten = 0;
        WriteFile(m_hComm, buffer, size, &bytesWritten, NULL);
        return bytesWritten;
    }
    
    void Close() {
        if (m_hComm != INVALID_HANDLE_VALUE) {
            CloseHandle(m_hComm);
            m_hComm = INVALID_HANDLE_VALUE;
        }
    }
};
```

---

## 七、面试回答模板

### Q1：MFC消息映射机制是怎么工作的？

> MFC使用消息映射宏（BEGIN_MESSAGE_MAP/END_MESSAGE_MAP）建立消息与处理函数的映射表。
> 
> 工作原理：
> 1. 每个CWnd派生类有一个静态消息映射表
> 2. 消息进入后，从当前类开始向上查找映射表
> 3. 找到匹配项则调用对应函数，否则交给DefWindowProc
> 
> 与虚函数的区别：
> - 虚函数需要为每个消息定义虚函数，开销大
> - 消息映射只需要表项，更高效

### Q2：MFC文档/视图架构的作用？

> 文档/视图架构实现了数据与显示的分离（MVC思想）。
> 
> 组成：
> - **CDocument**：管理数据，负责加载/保存
> - **CView**：负责显示和用户交互
> - **CFrameWnd**：管理视图的容器
> 
> 优点：
> - 数据与显示解耦，便于维护
> - 支持多视图显示同一文档
> - 内置序列化（Save/Load）支持

### Q3：MFC怎么避免界面闪烁？

> 1. **双缓冲绘图**：先在内存DC绘制，再一次性BitBlt到屏幕
> 2. **OnEraseBkgnd返回TRUE**：禁止背景擦除
> 3. **InvalidateRect**：只刷新需要更新的区域
> 4. **LockWindowUpdate**：批量更新时锁定窗口

### Q4：MFC多线程注意事项？

> 1. **UI只能在主线程操作**：工作线程通过PostMessage通知UI线程
> 2. **共享数据需要同步**：使用CCriticalSection或CMutex
> 3. **避免死锁**：按固定顺序获取锁
> 4. **CWnd对象不能跨线程**：CWnd绑定到创建它的线程

---

## 八、常用技巧

### 8.1 获取控件指针

```cpp
CEdit* pEdit = (CEdit*)GetDlgItem(IDC_EDIT1);
pEdit->SetWindowText(_T("Hello"));

// 或使用DDX_Control绑定
DDX_Control(pDX, IDC_EDIT1, m_edit);
```

### 8.2 定时器

```cpp
// 启动定时器
SetTimer(1, 1000, NULL);  // ID=1, 间隔1秒

// 处理定时器消息
ON_WM_TIMER()

void CMyDlg::OnTimer(UINT_PTR nIDEvent) {
    if (nIDEvent == 1) {
        // 定时处理
    }
    CDialog::OnTimer(nIDEvent);
}

// 停止定时器
KillTimer(1);
```

### 8.3 注册表操作

```cpp
CWinApp* pApp = AfxGetApp();

// 写入
pApp->WriteProfileInt(_T("Settings"), _T("Value"), 123);
pApp->WriteProfileString(_T("Settings"), _T("Name"), _T("Test"));

// 读取
int nValue = pApp->GetProfileInt(_T("Settings"), _T("Value"), 0);
CString strName = pApp->GetProfileString(_T("Settings"), _T("Name"), _T(""));
```
