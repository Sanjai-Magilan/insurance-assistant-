const fs = require('fs').promises;
const path = require('path');

class PlanManager {
    constructor() {
        this.plansBasePath = path.join(__dirname, '../../data/plans');
    }

    // Get all plans with their metadata
    async getAllPlans() {
        const plans = [];
        const books = await this.getAvailableBooks();

        for (const book of books) {
            const bookPath = path.join(this.plansBasePath, book);
            try {
                const files = await fs.readdir(bookPath);
                const jsonFiles = files.filter(file => file.endsWith('.json'));

                for (const file of jsonFiles) {
                    const filePath = path.join(bookPath, file);
                    try {
                        const stats = await fs.stat(filePath);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const planData = JSON.parse(content);

                        plans.push({
                            filePath: filePath.replace(/\\/g, '/'), // Normalize paths for web
                            absolutePath: filePath, // Keep original absolute path for file operations
                            filename: file,
                            book: book,
                            planName: planData.plan_details?.['Plan Name'] || planData.planName || 'Unknown Plan',
                            company: planData.plan_details?.Company || planData.company || 'Unknown Company',
                            sumInsuredRange: planData.plan_details?.['Sum Insured Range'] || planData.sumInsuredRange || 'Unknown',
                            lastModified: stats.mtime.toISOString(),
                            size: stats.size
                        });
                    } catch (error) {
                        console.error(`Error reading plan file ${filePath}:`, error);
                    }
                }
            } catch (error) {
                console.error(`Error reading book directory ${book}:`, error);
            }
        }

        return plans;
    }

    // Get available books
    async getAvailableBooks() {
        try {
            const items = await fs.readdir(this.plansBasePath);
            const books = [];
            
            for (const item of items) {
                const itemPath = path.join(this.plansBasePath, item);
                const stats = await fs.stat(itemPath);
                if (stats.isDirectory() && item.startsWith('book')) {
                    books.push(item);
                }
            }
            
            return books.sort();
        } catch (error) {
            console.error('Error getting available books:', error);
            return [];
        }
    }

    // Get plan by file path
    async getPlan(requestedFilePath) {
        try {
            // Handle both normalized paths from web and absolute paths
            let actualFilePath = requestedFilePath;
            
            // If it's a normalized path from web, convert it back to absolute path
            if (!path.isAbsolute(requestedFilePath)) {
                actualFilePath = path.join(this.plansBasePath, requestedFilePath);
            } else if (requestedFilePath.includes('/')) {
                // If it contains forward slashes, it might be a normalized web path
                // Convert forward slashes back to backslashes and check if it's a relative path
                const normalizedPath = requestedFilePath.replace(/\//g, '\\');
                if (!path.isAbsolute(normalizedPath)) {
                    actualFilePath = path.join(this.plansBasePath, normalizedPath);
                } else {
                    actualFilePath = normalizedPath;
                }
            }
            
            console.log('Requested path:', requestedFilePath);
            console.log('Actual path:', actualFilePath);
            
            const content = await fs.readFile(actualFilePath, 'utf-8');
            const planData = JSON.parse(content);
            const stats = await fs.stat(actualFilePath);
            
            return {
                data: planData,
                filename: path.basename(actualFilePath),
                book: path.basename(path.dirname(actualFilePath)),
                lastModified: stats.mtime.toISOString(),
                size: stats.size,
                absolutePath: actualFilePath
            };
        } catch (error) {
            throw new Error(`Failed to read plan: ${error.message}`);
        }
    }

    // Create new plan
    async createPlan(fileName, book, planData) {
        try {
            // Ensure book directory exists
            const bookPath = path.join(this.plansBasePath, book);
            await fs.mkdir(bookPath, { recursive: true });

            // Create file path
            const filePath = path.join(bookPath, fileName);

            // Check if file already exists
            try {
                await fs.access(filePath);
                throw new Error('File already exists');
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            // Add metadata to plan data
            const enrichedPlanData = {
                ...planData,
                planName: planData.plan_details?.['Plan Name'] || 'Unknown Plan',
                company: planData.plan_details?.Company || 'Unknown Company',
                sumInsuredRange: planData.plan_details?.['Sum Insured Range'] || 'Unknown',
                normalizedSumInsured: this.normalizeSumInsured(planData.plan_details?.['Sum Insured Range'] || ''),
                generatedFilename: fileName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Write file
            await fs.writeFile(filePath, JSON.stringify(enrichedPlanData, null, 2), 'utf-8');

            return {
                success: true,
                filePath: filePath,
                message: 'Plan created successfully'
            };
        } catch (error) {
            throw new Error(`Failed to create plan: ${error.message}`);
        }
    }

    // Update existing plan
    async updatePlan(originalFilePath, fileName, book, planData) {
        try {
            const newBookPath = path.join(this.plansBasePath, book);
            await fs.mkdir(newBookPath, { recursive: true });

            const newFilePath = path.join(newBookPath, fileName);

            // If the file path has changed, we need to delete the old file
            const filePathChanged = originalFilePath !== newFilePath;

            // Add metadata to plan data
            const enrichedPlanData = {
                ...planData,
                planName: planData.plan_details?.['Plan Name'] || 'Unknown Plan',
                company: planData.plan_details?.Company || 'Unknown Company',
                sumInsuredRange: planData.plan_details?.['Sum Insured Range'] || 'Unknown',
                normalizedSumInsured: this.normalizeSumInsured(planData.plan_details?.['Sum Insured Range'] || ''),
                generatedFilename: fileName,
                updatedAt: new Date().toISOString()
            };

            // Preserve original creation date if it exists
            if (planData.createdAt) {
                enrichedPlanData.createdAt = planData.createdAt;
            }

            // Write to new location
            await fs.writeFile(newFilePath, JSON.stringify(enrichedPlanData, null, 2), 'utf-8');

            // Delete old file if path changed
            if (filePathChanged) {
                try {
                    await fs.unlink(originalFilePath);
                } catch (error) {
                    console.warn(`Failed to delete old file ${originalFilePath}:`, error.message);
                }
            }

            return {
                success: true,
                filePath: newFilePath,
                message: 'Plan updated successfully'
            };
        } catch (error) {
            throw new Error(`Failed to update plan: ${error.message}`);
        }
    }

    // Delete plan
    async deletePlan(filePath) {
        try {
            await fs.unlink(filePath);
            return {
                success: true,
                message: 'Plan deleted successfully'
            };
        } catch (error) {
            throw new Error(`Failed to delete plan: ${error.message}`);
        }
    }

    // Get dashboard statistics
    async getStats() {
        try {
            const plans = await this.getAllPlans();
            const companies = [...new Set(plans.map(plan => plan.company))];
            const books = await this.getAvailableBooks();
            
            const lastModified = plans.reduce((latest, plan) => {
                const planDate = new Date(plan.lastModified);
                return planDate > latest ? planDate : latest;
            }, new Date(0));

            return {
                totalPlans: plans.length,
                totalCompanies: companies.length,
                totalBooks: books.length,
                lastUpdated: lastModified.toLocaleDateString()
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                totalPlans: 0,
                totalCompanies: 0,
                totalBooks: 0,
                lastUpdated: 'Unknown'
            };
        }
    }

    // Export all plans as ZIP
    async exportPlans() {
        try {
            const archiver = require('archiver');
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            const books = await this.getAvailableBooks();
            
            for (const book of books) {
                const bookPath = path.join(this.plansBasePath, book);
                archive.directory(bookPath, book);
            }
            
            archive.finalize();
            return archive;
        } catch (error) {
            throw new Error(`Failed to export plans: ${error.message}`);
        }
    }

    // Utility function to normalize sum insured values
    normalizeSumInsured(sumInsured) {
        if (!sumInsured) return '';
        return sumInsured.toLowerCase().replace(/\s+/g, '');
    }

    // Validate plan data structure
    validatePlanData(planData) {
        const errors = [];

        // Check required fields
        if (!planData.plan_details) {
            errors.push('Missing plan_details section');
        } else {
            if (!planData.plan_details['Plan Name']) {
                errors.push('Missing Plan Name in plan_details');
            }
            if (!planData.plan_details.Company) {
                errors.push('Missing Company in plan_details');
            }
        }

        if (!planData.basic_coverages) {
            errors.push('Missing basic_coverages section');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Search plans
    async searchPlans(query, filters = {}) {
        try {
            const allPlans = await this.getAllPlans();
            
            let filteredPlans = allPlans;

            // Apply text search
            if (query) {
                const searchTerm = query.toLowerCase();
                filteredPlans = filteredPlans.filter(plan => 
                    plan.planName.toLowerCase().includes(searchTerm) ||
                    plan.company.toLowerCase().includes(searchTerm) ||
                    plan.sumInsuredRange.toLowerCase().includes(searchTerm)
                );
            }

            // Apply filters
            if (filters.company) {
                filteredPlans = filteredPlans.filter(plan => plan.company === filters.company);
            }

            if (filters.book) {
                filteredPlans = filteredPlans.filter(plan => plan.book === filters.book);
            }

            if (filters.sumInsured) {
                filteredPlans = filteredPlans.filter(plan => plan.sumInsuredRange === filters.sumInsured);
            }

            return {
                plans: filteredPlans,
                total: filteredPlans.length
            };
        } catch (error) {
            throw new Error(`Search failed: ${error.message}`);
        }
    }
}

module.exports = { PlanManager };
