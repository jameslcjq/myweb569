Option Explicit

' --- 修正点：补全了 wb1, wb2, ws1, ws2 的定义 ---
Dim objExcel, wb, ws, wb1, wb2, ws1, ws2, fso, folder, file, ext
Dim path, file1, file2, outputFile, unitName
Dim arr1, arr2, arrOut
Dim lastRow1, lastRow2, totalRows
Dim i, id, salary1, salary2, matchRow
Dim dict12, outIndex, excelRow
Dim key, leftOverKeys
Dim f2Value

' --- 初始化 ---
Set fso = CreateObject("Scripting.FileSystemObject")
path = fso.GetParentFolderName(WScript.ScriptFullName)
Set folder = fso.GetFolder(path)

Set objExcel = CreateObject("Excel.Application")
objExcel.Visible = False
objExcel.DisplayAlerts = False
objExcel.ScreenUpdating = False

' ==========================================
' 第一步：智能重命名 (根据F2单元格)
' ==========================================
For Each file In folder.Files
    ext = LCase(fso.GetExtensionName(file.Name))
    ' 只处理 xls 或 xlsx，且排除临时文件(~$开头)
    If (ext = "xls" Or ext = "xlsx") And Left(file.Name, 2) <> "~$" Then
        
        ' 打开文件检查 F2
        Set wb = objExcel.Workbooks.Open(file.Path)
        Set ws = wb.Sheets(1)
        On Error Resume Next
        f2Value = Trim(ws.Range("F2").Value)
        On Error Goto 0
        wb.Close False
        
        ' 根据 F2 的值重命名
        If CStr(f2Value) = "2" Then
            Call SafeRename(file, "工资2." & ext)
        ElseIf CStr(f2Value) = "12" Then
            Call SafeRename(file, "工资12." & ext)
        End If
    End If
Next

' ==========================================
' 第二步：定位文件并准备读取
' ==========================================
file1 = FindFile(folder, "工资2")
file2 = FindFile(folder, "工资12")

If file1 = "" Or file2 = "" Then
    MsgBox "错误：未能自动识别到文件。" & vbCrLf & "请确保表格在当前文件夹下，且 F2 单元格内容分别为 2 和 12。", 16, "文件缺失"
    objExcel.Quit
    WScript.Quit
End If

' 打开文件 (此前报错就是因为这里用了 wb1 未定义)
Set wb1 = objExcel.Workbooks.Open(path & "\" & file1)
Set wb2 = objExcel.Workbooks.Open(path & "\" & file2)
Set ws1 = wb1.Sheets(1)
Set ws2 = wb2.Sheets(1)

' --- 获取 B2 内容用于命名 ---
unitName = Trim(ws1.Range("B2").Value)
If unitName = "" Then unitName = "结果表"
outputFile = unitName & "绩效工资.xlsx"

' --- 清理旧的结果文件 ---
If fso.FileExists(path & "\" & outputFile) Then
    On Error Resume Next
    fso.DeleteFile path & "\" & outputFile
    If Err.Number <> 0 Then
        MsgBox "请先关闭 [" & outputFile & "] 再运行！", 16, "错误"
        wb1.Close False: wb2.Close False: objExcel.Quit
        WScript.Quit
    End If
    On Error Goto 0
End If

' --- 读入内存 ---
lastRow1 = ws1.Cells(ws1.Rows.Count, 1).End(-4162).Row
lastRow2 = ws2.Cells(ws2.Rows.Count, 1).End(-4162).Row

arr1 = ws1.Range("A1:P" & lastRow1).Value 
arr2 = ws2.Range("A1:P" & lastRow2).Value

wb1.Close False
wb2.Close False

' ==========================================
' 第三步：核心比对逻辑
' ==========================================
totalRows = lastRow1 + lastRow2
ReDim arrOut(totalRows, 11) 

' 表头
arrOut(0, 0) = "数据来源"
arrOut(0, 1) = "姓名"
arrOut(0, 2) = "证件号码"
arrOut(0, 3) = "岗位工资"
arrOut(0, 4) = "薪级工资"
arrOut(0, 5) = "小计"
arrOut(0, 6) = "岗位津贴"
arrOut(0, 7) = "生活补贴"
arrOut(0, 8) = "农村学校教师补贴"
arrOut(0, 9) = "月标准小计"
arrOut(0, 10) = "计发月份"
arrOut(0, 11) = "全年金额"

outIndex = 1 

' 建立索引
Set dict12 = CreateObject("Scripting.Dictionary")
For i = 2 To UBound(arr2, 1)
    id = Trim(arr2(i, 8)) 
    If id <> "" Then dict12(id) = i 
Next

' --- 遍历工资2 ---
For i = 2 To UBound(arr1, 1)
    id = Trim(arr1(i, 8))
    salary1 = arr1(i, 13)
    
    If dict12.Exists(id) Then
        matchRow = dict12(id)
        salary2 = arr2(matchRow, 13)
        
        If CStr(salary1) <> CStr(salary2) Then
            ' [差异]：两行都输出，月份留空
            Call AddToOutput(arrOut, outIndex, arr1, i, "工资2", "")
            outIndex = outIndex + 1
            Call AddToOutput(arrOut, outIndex, arr2, matchRow, "工资12 [差异]", "")
            outIndex = outIndex + 1
        Else
            ' [正常]：只输出工资2，月份填12
            Call AddToOutput(arrOut, outIndex, arr1, i, "工资2", 12)
            outIndex = outIndex + 1
        End If
        dict12.Remove(id) 
    Else
        ' [工资12缺]
        Call AddToOutput(arrOut, outIndex, arr1, i, "工资2 [工资12缺]", "")
        outIndex = outIndex + 1
    End If
Next

' --- 处理工资2缺 (工资12剩余) ---
leftOverKeys = dict12.Keys
If UBound(leftOverKeys) >= 0 Then
    For Each key In leftOverKeys
        matchRow = dict12(key)
        ' [工资2缺]：特殊处理 -> 岗位/薪级/小计留空，月份填4
        Call AddSpecialOutput(arrOut, outIndex, arr2, matchRow, "工资12 [工资2缺]", 4)
        outIndex = outIndex + 1
    Next
End If

' ==========================================
' 第四步：写入与保存
' ==========================================
Set wb = objExcel.Workbooks.Add
Set ws = wb.Sheets(1)

ws.Columns("C:C").NumberFormat = "@"
ws.Range("A1").Resize(outIndex, 12).Value = arrOut

' 格式化
ws.Range("A1:L1").Font.Bold = True
ws.Columns("A:L").AutoFit

Dim r, sourceText
For r = 2 To outIndex
    sourceText = ws.Cells(r, 1).Value
    If InStr(sourceText, "差异") > 0 Or InStr(sourceText, "缺") > 0 Then
        ws.Rows(r).Interior.Color = 65535 ' 黄色
    End If
Next

wb.SaveAs path & "\" & outputFile, 51
wb.Close False

objExcel.ScreenUpdating = True
objExcel.Quit

MsgBox "处理完成！" & vbCrLf & "文件已保存为：" & outputFile, 64, "成功"


' ==========================================
' 辅助函数
' ==========================================
Sub SafeRename(fileObj, newName)
    Dim fso, parent
    Set fso = CreateObject("Scripting.FileSystemObject")
    parent = fso.GetParentFolderName(fileObj.Path)
    If LCase(fileObj.Name) = LCase(newName) Then Exit Sub
    If fso.FileExists(parent & "\" & newName) Then
        fso.DeleteFile parent & "\" & newName, True
    End If
    fileObj.Name = newName
End Sub

Function FindFile(folderObj, prefix)
    Dim f, n
    For Each f In folderObj.Files
        n = f.Name
        If (Left(n, Len(prefix)) = prefix) And (InStr(n, ".xls") > 0) Then
            FindFile = n
            Exit Function
        End If
    Next
    FindFile = ""
End Function

Sub AddToOutput(arrTarget, rOut, arrSource, rSrc, sourceTxt, monthVal)
    Dim excelRow: excelRow = rOut + 1
    arrTarget(rOut, 0) = sourceTxt
    arrTarget(rOut, 1) = arrSource(rSrc, 7)
    arrTarget(rOut, 2) = arrSource(rSrc, 8)
    arrTarget(rOut, 3) = arrSource(rSrc, 13)
    arrTarget(rOut, 4) = arrSource(rSrc, 14)
    arrTarget(rOut, 5) = "=ROUNDUP((D" & excelRow & "+E" & excelRow & ")/12*K" & excelRow & ",0)"
    arrTarget(rOut, 6) = arrSource(rSrc, 15)
    arrTarget(rOut, 7) = arrSource(rSrc, 16)
    arrTarget(rOut, 8) = ""
    arrTarget(rOut, 9) = "=G" & excelRow & "+H" & excelRow
    arrTarget(rOut, 10) = monthVal
    arrTarget(rOut, 11) = "=J" & excelRow & "*K" & excelRow
End Sub

Sub AddSpecialOutput(arrTarget, rOut, arrSource, rSrc, sourceTxt, monthVal)
    Dim excelRow: excelRow = rOut + 1
    arrTarget(rOut, 0) = sourceTxt
    arrTarget(rOut, 1) = arrSource(rSrc, 7)
    arrTarget(rOut, 2) = arrSource(rSrc, 8)
    arrTarget(rOut, 3) = "" ' 空
    arrTarget(rOut, 4) = "" ' 空
    arrTarget(rOut, 5) = "" ' 空
    arrTarget(rOut, 6) = arrSource(rSrc, 15)
    arrTarget(rOut, 7) = arrSource(rSrc, 16)
    arrTarget(rOut, 8) = ""
    arrTarget(rOut, 9) = "=G" & excelRow & "+H" & excelRow
    arrTarget(rOut, 10) = monthVal
    arrTarget(rOut, 11) = "=J" & excelRow & "*K" & excelRow
End Sub