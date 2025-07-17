/**
 * Response Formatter - Handles dynamic response formatting and table generation
 */
class ResponseFormatter {
    
    /**
     * Format response dynamically based on content type
     */
    static formatDynamicResponse(content, planContext, responseType = 'auto') {
        if (!content) return '';
        
        const cleanContent = typeof content === 'string' ? content.trim() : String(content);
        
        // Auto-detect response type if not specified
        if (responseType === 'auto') {
            responseType = this.detectResponseType(cleanContent);
        }
        
        switch (responseType) {
            case 'table':
                return this.formatTableResponse(cleanContent, planContext);
            case 'list':
                return this.formatListResponse(cleanContent, planContext);
            case 'detailed':
                return this.formatDetailedResponse(cleanContent, planContext);
            default:
                return this.formatStandardResponse(cleanContent, planContext);
        }
    }
    
    /**
     * Detect the type of response needed
     */
    static detectResponseType(content) {
        if (content.includes('|') && content.includes('---')) {
            return 'table';
        }
        if (content.includes('<table') || content.includes('</table>')) {
            return 'table';
        }
        if (content.includes('•') || content.includes('-') || content.includes('*')) {
            return 'list';
        }
        if (content.length > 500) {
            return 'detailed';
        }
        return 'standard';
    }
    
    /**
     * Format table response
     */
    static formatTableResponse(content, planContext) {
        // Convert to proper HTML table if not already
        let processedContent = this.ensureHtmlTable(content);
        
        return `<div class="structured-response">
            <div class="response-header">
                🏥 <strong>${planContext.company} - ${planContext.planName} (${planContext.sumInsured})</strong>
            </div>
            <div class="response-section">
                ${processedContent}
            </div>
            <div class="response-footer">
                📊 <em>Detailed plan information in table format</em>
            </div>
        </div>`;
    }
    
    /**
     * Format list response
     */
    static formatListResponse(content, planContext) {
        let processedContent = this.enhanceListFormatting(content);
        
        return `<div class="structured-response">
            <div class="response-header">
                📋 <strong>${planContext.company} - ${planContext.planName}</strong>
            </div>
            <div class="response-section">
                ${processedContent}
            </div>
        </div>`;
    }
    
    /**
     * Format detailed response
     */
    static formatDetailedResponse(content, planContext) {
        let processedContent = this.enhanceDetailedFormatting(content);
        
        return `<div class="structured-response">
            <div class="response-header">
                📖 <strong>${planContext.company} - ${planContext.planName} (${planContext.sumInsured})</strong>
            </div>
            <div class="response-section">
                ${processedContent}
            </div>
            <div class="response-footer">
                💡 <em>Comprehensive plan information - Contact customer service for specific claims</em>
            </div>
        </div>`;
    }
    
    /**
     * Format standard response
     */
    static formatStandardResponse(content, planContext) {
        let processedContent = this.enhanceStandardFormatting(content);
        
        return `<div class="structured-response">
            <div class="response-section">
                ${processedContent}
            </div>
        </div>`;
    }
    
    /**
     * Ensure content is in proper HTML table format
     */
    static ensureHtmlTable(content) {
        // If already HTML table, return as is
        if (content.includes('<table')) {
            return content;
        }
        
        // Convert markdown table to HTML
        const tableRegex = /(\|[^|\n]+\|[^|\n]*\n)(\|[-\s|:]+\|[^|\n]*\n)((?:\|[^|\n]+\|[^|\n]*\n?)+)/g;
        
        content = content.replace(tableRegex, (match, header, separator, rows) => {
            const headerCells = header.split('|').slice(1, -1).map(cell => cell.trim());
            const rowsArray = rows.trim().split('\n').map(row => 
                row.split('|').slice(1, -1).map(cell => cell.trim())
            );
            
            let html = '<table class="plan-table">';
            html += '<thead><tr>';
            headerCells.forEach(cell => {
                html += `<th>${cell}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            rowsArray.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    html += `<td>${this.formatCellContent(cell)}</td>`;
                });
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            return html;
        });
        
        return content;
    }
    
    /**
     * Create table from plan data object
     */
    static createTableFromObject(obj, title = '') {
        if (!obj || typeof obj !== 'object') return '';
        
        let html = `<table class="plan-table">`;
        
        if (title) {
            html += `<caption class="table-title">${title}</caption>`;
        }
        
        html += '<thead><tr><th>Feature</th><th>Details</th></tr></thead><tbody>';
        
        Object.entries(obj).forEach(([key, value]) => {
            if (value && value !== 'NO' && value !== 'N/A') {
                html += `<tr>
                    <td><strong>${this.formatFieldName(key)}</strong></td>
                    <td>${this.formatCellContent(value)}</td>
                </tr>`;
            }
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    /**
     * Create comparison table for multiple items
     */
    static createComparisonTable(items, headers) {
        if (!items || !Array.isArray(items) || items.length === 0) return '';
        
        let html = '<table class="plan-table comparison-table">';
        html += '<thead><tr>';
        
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        
        html += '</tr></thead><tbody>';
        
        items.forEach(item => {
            html += '<tr>';
            headers.forEach(header => {
                const value = item[header.toLowerCase().replace(/\s+/g, '_')] || item[header] || 'N/A';
                html += `<td>${this.formatCellContent(value)}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    /**
     * Format field names for display
     */
    static formatFieldName(fieldName) {
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ')
            .trim();
    }
    
    /**
     * Format cell content
     */
    static formatCellContent(content) {
        if (!content) return 'N/A';
        
        const strContent = String(content);
        
        // Format monetary values
        let formatted = strContent.replace(/(\₹[\d,]+|Rs\.?\s*[\d,]+|\d+%)/g, '<strong class="amount">$1</strong>');
        
        // Format important terms
        formatted = formatted.replace(/(IMPORTANT|NOTE|WARNING|EXCLUSION|INCLUDED|COVERED):/gi, '<strong class="important">$1:</strong>');
        
        // Format "YES" and "NO"
        formatted = formatted.replace(/\bYES\b/gi, '<span class="status-yes">YES</span>');
        formatted = formatted.replace(/\bNO\b/gi, '<span class="status-no">NO</span>');
        
        return formatted;
    }
    
    /**
     * Enhance list formatting
     */
    static enhanceListFormatting(content) {
        // Convert different bullet styles to HTML lists
        let lines = content.split('\n');
        let inList = false;
        let result = [];
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.match(/^[•\-\*]\s+/)) {
                if (!inList) {
                    result.push('<ul class="feature-list">');
                    inList = true;
                }
                const listItem = trimmed.replace(/^[•\-\*]\s+/, '');
                result.push(`<li class="feature-item">${this.formatCellContent(listItem)}</li>`);
            } else {
                if (inList) {
                    result.push('</ul>');
                    inList = false;
                }
                if (trimmed) {
                    if (trimmed.endsWith(':')) {
                        result.push(`<div class="section-title">${trimmed}</div>`);
                    } else {
                        result.push(`<p>${this.formatCellContent(trimmed)}</p>`);
                    }
                }
            }
        });
        
        if (inList) {
            result.push('</ul>');
        }
        
        return result.join('');
    }
    
    /**
     * Enhance detailed formatting
     */
    static enhanceDetailedFormatting(content) {
        // Split into sections and format each
        let sections = content.split(/\n\s*\n/);
        
        return sections.map(section => {
            const lines = section.split('\n');
            const firstLine = lines[0].trim();
            
            if (firstLine.endsWith(':') || firstLine.match(/^[A-Z\s]+$/)) {
                // This is a section header
                const header = `<div class="section-title">${firstLine}</div>`;
                const body = lines.slice(1).join('<br>');
                return header + (body ? `<div class="section-content">${this.formatCellContent(body)}</div>` : '');
            } else {
                // Regular content
                return `<p>${this.formatCellContent(section.replace(/\n/g, '<br>'))}</p>`;
            }
        }).join('');
    }
    
    /**
     * Enhance standard formatting
     */
    static enhanceStandardFormatting(content) {
        // Basic formatting for simple responses
        let formatted = this.formatCellContent(content);
        formatted = formatted.replace(/\n\n+/g, '</p><p>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        if (!formatted.includes('<p>')) {
            formatted = `<p>${formatted}</p>`;
        }
        
        return formatted;
    }
}

module.exports = { ResponseFormatter };
